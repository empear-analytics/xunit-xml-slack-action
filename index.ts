import dotenv from 'dotenv';
import * as core from '@actions/core';
import {IncomingWebhook} from "@slack/webhook";
import slackMessage from "./app/slack-message.js";
import createClickupTicket from './app/clickup-task.js';
import ResultsParser from './app/results-parser.js';


dotenv.config();
const testStepOutcome = core.getInput("test-step-outcome");
const slackWebhookUrl = core.getInput("slack-webhook-url") ? core.getInput("slack-webhook-url") : process.env.SLACK_WEBHOOK_URL;
const testOutputFile = core.getInput("directory-path") ? core.getInput("directory-path") : process.env.TEST_OUTPUT_FILE;
const shouldCreateClickupTask = (core.getInput("clickup-create-task") || process.env.CLICKUP_CREATE_TASK || "").trim().toLowerCase() === "true";
const clickupToken = core.getInput("clickup-token") ? core.getInput("clickup-token") : process.env.CLICKUP_TOKEN;
const listId = core.getInput("clickup-list-id") ? core.getInput("clickup-list-id") : process.env.CLICKUP_LIST_ID;
const uploadReport = (core.getInput("clickup-upload-report") || process.env.CLICKUP_UPLOAD_REPORT || "").trim().toLowerCase() === "true";


(async () => {
  const workspacePath = process.env.GITHUB_WORKSPACE;
  const filePath = workspacePath + '/' + testOutputFile
  const result = new ResultsParser(filePath);
  const message = await slackMessage(testStepOutcome, result);
  const webhook = new IncomingWebhook(slackWebhookUrl);
  await webhook.send(message);

  if (shouldCreateClickupTask && testStepOutcome === 'failure') {
    await createClickupTicket(result, clickupToken, listId, filePath, uploadReport);
  }
})();