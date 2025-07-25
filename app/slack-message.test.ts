import ResultsParser from './results-parser';
import slackMessage from './slack-message';

jest.mock('./action-info')

test('message object created for success step', async () => {
    const result = new ResultsParser("./app/results-all-ok.xml");
    const message = await slackMessage("success", result);
    expect(message).toHaveProperty("text", "undefined - Passed");
    expect(message).toHaveProperty("blocks");
})

test('message object created for failure step', async () => {
    const result = new ResultsParser("./app/results-with-failure-and-skipped.xml");
    const message = await slackMessage("failure", result);
    expect(message).toHaveProperty("text", "undefined - Failed");
    expect(message).toHaveProperty("blocks");
})

test('message object created for missing result file', async () => {
    const result = new ResultsParser("foo.xml");
    const message = await slackMessage("failure", result);
    expect(message).toHaveProperty("text", "undefined - NO TEST RESULT");
    expect(message).toHaveProperty("blocks");
})

test('message object created for cancelled step', async () => {
    const result = new ResultsParser("./app/results-all-ok.xml");
    const message = await slackMessage("cancelled", result);
    expect(message).toHaveProperty("text", "undefined - TEST NOT FINISHED");
    expect(message).toHaveProperty("blocks");
})

test('message object created for skipped step', async () => {
    const result = new ResultsParser("./app/results-all-ok.xml");
    const message = await slackMessage("skipped", result);
    expect(message).toHaveProperty("text", "undefined - TEST NOT FINISHED");
    expect(message).toHaveProperty("blocks");
})

test('message object created for missing step outcome', async () => {
    const result = new ResultsParser("./app/results-all-ok.xml");
    const message = await slackMessage(null, result);
    expect(message).toHaveProperty("text", "undefined - UNKNOWN RESULT");
    expect(message).toHaveProperty("blocks");
})







