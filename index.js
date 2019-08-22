#! /usr/bin/env node

const handlebars = require('handlebars');
const fs = require('fs');
const { ArgumentParser } = require('argparse');
const fetch = require('node-fetch');
const moment = require('moment');
const dotenv = require('dotenv');
const iconv = require('iconv-lite');
const { minify } = require('html-minifier');

/*
  renderTemplateFromData is designed to take in an email template, some data
  to render it with, and simply returns the rendered html.
*/
function renderTemplateFromData(source, data) {
  const template = handlebars.compile(source);
  const html = template(data);
  return minify(html, { collapseWhitespace: true, removeEmptyElements: true });
}

/*
  getDataFromFileAsync takes as its parameter a file path and returns a promise,
  which, when it returns, returns the data of the file. It can be used to open
  and read an email template file.
*/
async function getDataFromFileAsync(file) {
  const response = await new Promise((resolve, reject) => {
    fs.readFile(file, 'utf8', (err, data) => {
      if (err) return reject(err);
      return resolve(data);
    });
  });
  if (response instanceof Error) {
    throw response;
  }
  return response;
}

/*
  writeDataToFileAsync takes as its parameter a file path and some data, and it
  saves the data to the file. It can be used to save rendered html to disk for
  viewing later.
*/
async function writeDataToFileAsync(file, input) {
  const response = await new Promise((resolve, reject) => {
    fs.writeFile(file, input, 'utf8', (err, data) => {
      if (err) return reject(err);
      return resolve(data);
    });
  });
  if (response instanceof Error) {
    throw response;
  }
  return response;
}

function getDataByProgramByDateAsync(programPath, date) {
  const url = `https://api.tanachstudy.com/${programPath}/schedule/${date}`;
  return fetch(url);
}

function transformAPIDataToTemplateData(apiData, context) {
  const { programPath } = context || {};

  const { segment_name: segmentName,
    segment_title: segmentTitle,
    segment_sponsor: segmentSponsor,
    section_name: sectionName,
    section_title: sectionTitle,
    section_sponsor: sectionSponsor,
    segment,
    section } = apiData[0] || {};

  const mappedParts = apiData.map((p) => {
    const { unit, part, part_title: partTitle, audio_url: audio } = p || {};
    const { host, path } = audio || {};
    return {
      unit,
      part,
      partTitle,
      audioURL: `${host}${path}`,
      pageURL: `https://tanachstudy.com/${programPath}/perek/${segment}/${section}/${unit}?part=${part}`,
    };
  });

  const templateData = {
    segmentName,
    segmentTitle,
    segmentSponsor: segmentSponsor || 'Sponsorship Available',
    sectionName,
    sectionTitle,
    sectionSponsor: sectionSponsor || 'Sponsorship Available',
    parts: mappedParts,
  };

  return templateData;
}

function getTemplateFilePathsFromProgram(program) {
  const templatePaths = {};
  switch (program) {
    case 'tanach':
    case 'nach':
      templatePaths.html = './templates/tanach.html';
      templatePaths.text = './templates/tanach.txt';
      break;
    case 'mishna':
      templatePaths.html = './templates/mishna.html';
      templatePaths.text = './templates/mishna.txt';
      break;
    case 'parasha':
      templatePaths.html = './templates/parasha.html';
      templatePaths.text = './templates/parasha.txt';
      break;
    default:
      templatePaths.html = '';
      templatePaths.text = '';
  }
  return templatePaths;
}

async function parseFetchResponseAsJSONAsync(res) {
  let returnValue;
  try {
    returnValue = await res.json();
  } catch (e) {
    throw e;
  }
  return returnValue;
}

function generateSubject(context, templateData) {
  const { sectionName, sectionTitle, parts } = templateData;

  const startUnit = parts.reduce((a, cur) => (cur.unit < a.unit ? cur.unit : a.unit));
  const startPart = parts.reduce((a, cur) => (cur.part < a.part ? cur.part : a.part));
  const endUnit = parts.reduce((a, cur) => (cur.unit > a.unit ? cur.unit : a.unit));
  const endPart = parts.reduce((a, cur) => (cur.part > a.part ? cur.part : a.part));

  let textPortion = '';
  if (startUnit === endUnit) {
    if (startPart === endPart) {
      textPortion = `${startUnit}:${startUnit}`;
    } else {
      textPortion = `${startUnit}:${startUnit}-${endPart}`;
    }
  } else {
    textPortion = `${startUnit}:${startUnit} - ${endUnit}:${endPart}`;
  }
  return `${sectionName} ${sectionTitle}: ${textPortion}`;
}

function generateCampaignName(context, subject) {
  const { date } = context;
  const formatted = moment(date, 'MM-DD-YYYY').format('MM/DD/YYYY');

  return `TEST ${Date.now()} ${subject} - ${formatted}`;
}

function cleanString(input) {
  let output = '';
  for (let i = 0; i < input.length; i++) {
    if (input.charCodeAt(i) <= 127) {
      output += input.charAt(i);
    }
  }
  return output;
}

function generateConstantContactEmailRequest(context, templateData, renderedHTML, renderedText) {
  const { fromName, fromEmail, replyEmail } = context;
  const subject = generateSubject(context, templateData);
  const campaignName = generateCampaignName(context, subject);
  const req = {
    name: campaignName,
    subject,
    from_name: fromName,
    from_email: fromEmail,
    reply_to_email: replyEmail || fromEmail,
    is_view_as_webpage_enabled: true,
    view_as_web_page_text: 'View this email as a web page',
    view_as_web_page_link_text: 'Click here to view as web page',
    email_content: iconv.decode(iconv.encode(cleanString(renderedHTML), 'utf8'), 'iso-8859-1'),
    text_content: iconv.decode(iconv.encode(cleanString(renderedText), 'utf8'), 'iso-8859-1'),
    email_content_format: 'HTML',
  };
  return req;
}

function postDataToConstantContactEmailCreateApi(reqBody) {
  const { CC_KEY, CC_TOKEN } = process.env;
  const url = `https://api.constantcontact.com/v2/emailmarketing/campaigns?api_key=${CC_KEY}`;
  return fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${CC_TOKEN}`,
    },
    method: 'POST',
    body: JSON.stringify(reqBody),
  });
}

function generateConstantContactScheduleRequest(context, campaignID) {
  const req = {
    name: campaignName,
    subject,
    from_name: fromName,
    from_email: fromEmail,
    reply_to_email: replyEmail || fromEmail,
    is_view_as_webpage_enabled: true,
    view_as_web_page_text: 'View this email as a web page',
    view_as_web_page_link_text: 'Click here to view as web page',
    email_content: iconv.decode(iconv.encode(cleanString(renderedHTML), 'utf8'), 'iso-8859-1'),
    text_content: iconv.decode(iconv.encode(cleanString(renderedText), 'utf8'), 'iso-8859-1'),
    email_content_format: 'HTML',
  };
  return req;
}

function postDataToConstantContactEmailScheduleApi(reqBody) {
  const { CC_KEY, CC_TOKEN } = process.env;
  const url = `https://api.constantcontact.com/v2/emailmarketing/campaigns?api_key=${CC_KEY}`;
  return fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${CC_TOKEN}`,
    },
    method: 'POST',
    body: JSON.stringify(reqBody),
  });
}

function parseConstantContactEmailCreateResponse(response) {
  if (Array.isArray(response)) {
    const obj = response[0] || {};
    if (obj.error_key) {
      throw new Error(`ERROR ${obj.error_key}: ${obj.error_message}`);
    }
  }

  return response.id;
}

function finish(response) {
  console.log(response);
}
/*
  run takes as its parameter a context object, which has data about which
  program we wish to render. It should be called by main, which should set this
  context object.
*/
async function run(context) {
  dotenv.config({ silent: true });
  const { program, programPath, date } = context || {};

  const templateFilePaths = getTemplateFilePathsFromProgram(program);
  const { html: htmlTemplateFilePath, text: textTemplateFilePath } = templateFilePaths;

  try {
    const htmlTemplate = await getDataFromFileAsync(htmlTemplateFilePath);
    const textTemplate = await getDataFromFileAsync(textTemplateFilePath);
    const apiResponse = await getDataByProgramByDateAsync(programPath, date.toISOString());

    const apiData = await parseFetchResponseAsJSONAsync(apiResponse);

    const templateData = transformAPIDataToTemplateData(apiData, context);
    const htmlRendered = renderTemplateFromData(htmlTemplate, templateData);
    const textRendered = renderTemplateFromData(textTemplate, templateData);

    await writeDataToFileAsync('test.html', htmlRendered);
    await writeDataToFileAsync('test.txt', textRendered);

    const generateEmailRequest = generateConstantContactEmailRequest(context, templateData, htmlRendered, textRendered);

    const ccEmailApiResponse = await postDataToConstantContactEmailCreateApi(generateEmailRequest);
    const ccEmailApiData = await parseFetchResponseAsJSONAsync(ccEmailApiResponse);
    const campaignID = parseConstantContactEmailCreateResponse(ccEmailApiData);

    const scheduleApiRequest = generateConstantContactScheduleRequest(context, campaignID);
    const ccScheduleApiResponse = await postDataToConstantContactEmailScheduleApi(scheduleApiRequest);
    const ccScheduleApiData = await parseFetchResponseAsJSONAsync(ccScheduleApiResponse);
    finish(ccScheduleApiData);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

function getProgramPathFromProgram(program) {
  let path = '';
  switch (program) {
    case 'tanach':
    case 'nach':
      path = 'tanach-study';
      break;
    case 'mishna':
      path = 'mishna-study';
      break;
    case 'parasha':
      path = 'parasha-study';
      break;
    default:
      path = '';
  }
  return path;
}

function getProgramNameFromProgram(program) {
  let name = '';
  switch (program) {
    case 'tanach':
    case 'nach':
      name = 'Tanach Study';
      break;
    case 'mishna':
      name = 'Mishna Study';
      break;
    case 'parasha':
      name = 'Parasha Study';
      break;
    default:
      name = '';
  }
  return name;
}

function normalizeDate(date) {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

function validateListsInput(lists) {
  if (!lists || lists.length === 0) {
    throw new Error('Must specify a minimum of one list');
  }
  return lists;
}

function createArgsParser() {
  const parser = new ArgumentParser({
    version: '1.0.0',
    addHelp: true,
    description: 'Generate and schedule email campaigns for all Tanach Study programs',
  });
  parser.addArgument(
    ['-p', '--program'],
    {
      help: 'select which program to run with',
      action: 'store',
      dest: 'program',
      required: true,
    },
  );
  parser.addArgument(
    ['-d', '--date'],
    {
      help: 'set a date for the email',
      action: 'store',
      dest: 'date',
      required: true,
    },
  );
  parser.addArgument(
    ['-l', '--list'],
    {
      help: 'set a constant contact list id to send to',
      action: 'append',
      dest: 'lists',
      required: true,
    },
  );
  parser.addArgument(
    ['-f', '--fromName'],
    {
      help: 'set the \'from\' field of the email',
      action: 'store',
      dest: 'fromName',
      required: true,
    },
  );
  parser.addArgument(
    ['-e', '--fromEmail'],
    {
      help: 'set the \'from email\' field of the email',
      action: 'store',
      dest: 'fromEmail',
      required: true,
    },
  );
  parser.addArgument(
    ['-r', '--replyTo'],
    {
      help: 'set the \'reply to\' field of the email\nif unset, will default to fromAddress',
      action: 'store',
      dest: 'replyTo',
      required: false,
    },
  );
  return parser;
}

function cli() {
  const p = createArgsParser();
  const args = p.parseArgs();

  const { program: programArg,
    date: dateArg,
    lists: listsArg,
    fromName: fromNameArg,
    fromEmail: fromEmailArg,
    replyTo: replyToArg } = args;
  const normalizedProgram = programArg.toLowerCase();
  const lists = validateListsInput(listsArg);

  const context = {
    program: normalizedProgram,
    programPath: getProgramPathFromProgram(normalizedProgram),
    programName: getProgramNameFromProgram(normalizedProgram),
    date: normalizeDate(dateArg),
    lists,
    fromName: fromNameArg,
    fromEmail: fromEmailArg,
    replyTo: replyToArg,
  };
  return run(context);
}

function main(programArg, dateArg, listsArg, fromNameArg, fromEmailArg, replyToArg) {
  if (!programArg) {
    throw new Error('must specify program argument');
  }
  const normalizedProgram = programArg.toLowerCase();
  const lists = validateListsInput(listsArg);

  const context = {
    program: normalizedProgram,
    programPath: getProgramPathFromProgram(normalizedProgram),
    programName: getProgramNameFromProgram(normalizedProgram),
    date: normalizeDate(dateArg),
    lists,
    fromName: fromNameArg,
    fromEmail: fromEmailArg,
    replyTo: replyToArg,
  };
  return run(context);
}

if (!module.parent) {
  cli();
}

module.exports = {
  generateEmail: main,
};
