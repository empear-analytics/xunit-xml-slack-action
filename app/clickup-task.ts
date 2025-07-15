import ActionInfo from "./action-info";
import ResultsParser from "./results-parser";
import * as fs from 'fs';
import * as zlib from 'zlib';


export default async function createClickupTicket(result: ResultsParser, token: string, listId: string, filePath: string, uploadReport?: boolean) {
    const actionInfo: ActionInfo = new ActionInfo();
    const tokenToUse = token;
    const listIdToUse = listId; // board list id
    const shouldUploadReport = uploadReport ?? false;

    if (!tokenToUse || !listIdToUse) {
        console.error('Token or list id was not provided');
        return;
    }

    try {
        const failedTests = result.failedTests;
        const failedTestsList = result.failedTestsList;
        const failed = failedTests > 0;

        if (result.unsuccessFullRun || failed) {
            const date = new Date().toLocaleDateString('se');

            const url = `https://api.clickup.com/api/v2/list/${listId}/task`;

            const headers = new Headers();
            headers.append('Authorization', tokenToUse);
            headers.append("Accept", "application/json");
            headers.append("Content-Type", "application/json");

            const data = {
                "name": "Release blocked on " + date,
                "status": "BLOCKING",
                "description": result.unsuccessFullRun ? 'Tests did not run\n' + actionInfo.runUrl : actionInfo.runUrl + '\n' + failedTestsList
            }

            const requestOptions: RequestInit = {
                method: "POST",
                headers: headers,
                body: JSON.stringify(data),
            };

            const res = await fetch(url, requestOptions);

            if (result.unsuccessFullRun || !shouldUploadReport) {
                return;
            }

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

                const requestOptionsAttachment: RequestInit = {
                    method: "POST",
                    headers: headers,
                    body: formdata,
                };

                const resJson = await res.json();
                const taskId = resJson.id;

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
    } catch (e) {
        console.error('Clickup task creation failed');
        console.error(e);
    }
}