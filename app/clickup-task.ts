import ActionInfo from "./action-info";
import ResultsParser from "./results-parser";
import * as fs from 'fs';
import * as zlib from 'zlib';

function createHeaders(token: string): Headers {
    const headers = new Headers();
    headers.append('Authorization', token);
    headers.append("Accept", "application/json");
    headers.append("Content-Type", "application/json");
    return headers;
}

function createTaskData(result: ResultsParser, actionInfo: ActionInfo, date: string, failedTestsList: string[]): any {
    return {
        "name": "Execution failed on " + date,
        "status": "BLOCKING",
        "description": result.unsuccessFullRun ? 'Tests did not run\n' + actionInfo.runUrl : actionInfo.runUrl + '\n' + failedTestsList
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
 * @param filePath path to file
 * @param headers headers including authorization token
 * @param taskId id of Clickup task 
 */
async function uploadTaskAttachment(filePath: string, headers: Headers, taskId: string) {
    const readStream = fs.createReadStream(filePath);
    const writeStream = fs.createWriteStream(filePath + '.gz');
    const gzip = zlib.createGzip();

    readStream.pipe(gzip).pipe(writeStream);

    writeStream.on('finish', async () => {
        console.log('Report compressed successfully');

        const file = fs.readFileSync(filePath + '.gz');

        const blob = new Blob([file], { type: 'application/zip' });

        let formdata = new FormData();
        formdata.append("attachment", blob);

        const requestOptionsAttachment = createRequestInit('POST', headers, formdata)

        console.log('Attempting report upload');

        const resAttachment = await fetch(`https://api.clickup.com/api/v2/task/${taskId}/attachment`, requestOptionsAttachment);
        if (resAttachment.status === 200) {
            console.log('Report upload successful');
        } else {
            console.error('Report upload failed');
        }
    });

    writeStream.on('error', (err) => {
        console.error('Error compressing report:', err);
    });
}

export interface ClickupTaskData {
    result: ResultsParser,
    token: string,
    listId: string,
    filePath: string,
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

        if (data.result.unsuccessFullRun || failed) {
            const date = new Date().toLocaleDateString('se');
            const url = `https://api.clickup.com/api/v2/list/${listId}/task`;
            const headers = createHeaders(tokenToUse);
            const reqData = createTaskData(data.result, actionInfo, date, failedTestsList);

            const res = await createTask(url, headers, reqData);

            if (!data.result.unsuccessFullRun && shouldUploadReport) {
                const resJson = await res.json();
                const taskId = resJson.id;
                await uploadTaskAttachment(data.filePath, headers, taskId);
            }
        }
    } catch (e) {
        console.error('Clickup task creation failed');
        console.error(e);
    }
}