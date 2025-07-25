import ActionInfo from "./action-info";
import ResultsParser from "./results-parser";
import fs from 'fs';
import tar from "tar";
import path from "path";

function createHeaders(token: string): Headers {
    const headers = new Headers();
    headers.append('Authorization', token);
    headers.append("Accept", "application/json");
    headers.append("Content-Type", "application/json");
    return headers;
}

function createTaskData(actionInfo: ActionInfo, date: string, failedTestsList: string[]): any {
    return {
        "name": "Execution failed on " + date,
        "status": "BLOCKING",
        "description": actionInfo.runUrl + '\n\n' + failedTestsList.join(',\n')
    };
}

function createRequestInit(method: string, headers: Headers, body: any): RequestInit {
    return {
        method: method,
        headers: headers,
        body: body,
    };
}

async function createTask(url: string, headers: Headers, data: any): Promise<Response> {
    const requestOptions = createRequestInit('POST', headers, JSON.stringify(data));
    return await fetch(url, requestOptions);
}

/**
 * Uploads gzipped report to Clickup task as attachment
 * @param reportPath path to file
 * @param headers headers including authorization token
 * @param taskId id of Clickup task 
 */
async function uploadTaskAttachment(reportPath: string, headers: Headers, taskId: string) {
    const sourceDir = reportPath;
    const outputFile = reportPath + '.tar.gz';

    try {
        await tar.c(
            {
                gzip: true,
                file: outputFile,
                cwd: path.dirname(sourceDir)
            },
            [path.basename(sourceDir)]
        );

        console.log('Report compressed successfully');

        const file = fs.readFileSync(outputFile);

        const fileName = outputFile.split('/')[outputFile.split('/').length - 1];

        const blob = new Blob([file], { type: 'application/zip' });

        let formdata = new FormData();
        formdata.append("attachment", blob, fileName);

        const attachmentHeaders = headers;
        attachmentHeaders.delete('Content-Type');

        const requestOptionsAttachment = createRequestInit('POST', attachmentHeaders, formdata)

        console.log('Attempting report upload');

        const resAttachment = await fetch(`https://api.clickup.com/api/v2/task/${taskId}/attachment`, requestOptionsAttachment);

        if (resAttachment.status === 200) {
            console.log('Report upload successful');
        } else {
            console.error('Report upload failed');
            const resBody = await resAttachment.json();
            console.log(resBody);
        }
    } catch (err) {
        console.error('Error compressing report:', err);
    }
}

export interface ClickupTaskData {
    result: ResultsParser,
    token: string,
    listId: string,
    reportPath?: string,
    uploadReport?: boolean
}

/**
 * Creates a Clickup task using provided data; 
 * if tests failed, description will contain the failed test names
 * @param data data for Clickup task and whether to upload report as attachment
 */
export default async function createClickupTask(data: ClickupTaskData) {
    const actionInfo: ActionInfo = new ActionInfo();
    const tokenToUse = data.token;
    const listIdToUse = data.listId; // board list id
    const shouldUploadReport = data.uploadReport ?? false;

    if (!tokenToUse || !listIdToUse) {
        console.error('Token or list id was not provided');
        return;
    }

    try {
        const failedTests = data.result.failedTests;
        const failedTestsList = data.result.failedTestsList;
        const failed = failedTests > 0;

        if (failed) {
            const date = new Date().toLocaleDateString('se');
            const url = `https://api.clickup.com/api/v2/list/${listIdToUse}/task`;
            const headers = createHeaders(tokenToUse);
            const reqData = createTaskData(actionInfo, date, failedTestsList);

            const res = await createTask(url, headers, reqData);

            if (shouldUploadReport) {
                if (!data.reportPath) {
                    console.error('Report path was not provided');
                    return;
                }
                const resJson = await res.json();
                const taskId = resJson.id;
                await uploadTaskAttachment(data.reportPath, headers, taskId);
            }
        }
    } catch (e) {
        console.error('Clickup task creation failed');
        console.error(e);
    }
}