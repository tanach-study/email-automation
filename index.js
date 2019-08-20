#! /usr/bin/env node

const handlebars = require('handlebars');
const fs = require('fs');
const { ArgumentParser } = require('argparse');
const fetch = require('node-fetch');
const moment = require('moment');

/*
  renderTemplateFromData is designed to take in an email template, some data
  to render it with, and simply returns the rendered html.
*/
function renderTemplateFromData(source, data) {
  const template = handlebars.compile(source);
  const html = template(data);
  return html;
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

function getTemplateFilePathFromProgram(program) {
  let templatePath = '';
  switch (program) {
    case 'tanach':
    case 'nach':
      templatePath = './templates/tanach.html';
      break;
    case 'mishna':
      templatePath = './templates/mishna.html';
      break;
    case 'parasha':
      templatePath = './templates/parasha.html';
      break;
    default:
      templatePath = '';
  }
  return templatePath;
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

function generateCampaignName(context, templateData) {
  const { date } = context;
  const { sectionName, sectionTitle, parts } = templateData;
  const formatted = moment(date, 'MM-DD-YYYY').format('MM/DD/YYYY');

  const startUnit = parts.reduce((a, cur) => (cur.unit < a ? cur.unit : a));
  const startPart = parts.reduce((a, cur) => (cur.part < a ? cur.part : a));
  const endUnit = parts.reduce((a, cur) => (cur.unit > a ? cur.unit : a));
  const endPart = parts.reduce((a, cur) => (cur.part > a ? cur.part : a));

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
  const name = `${sectionName} ${sectionTitle}: ${textPortion} ${formatted}`;
  return name;
}

function generateSubject(context, templateData) {
  return '';
}

function generateConstantContactRequest(context, templateData, renderedHTML, renderedText) {
  const { fromName, fromEmail, replyEmail } = context;
  const campaignName = generateCampaignName(context, templateData);
  const subject = generateSubject(context, templateData);
  const req = {
    name: campaignName,
    subject,
    from_name: fromName,
    from_email: fromEmail,
    reply_to_email: replyEmail,
    is_permission_reminder_enabled: true,
    is_view_as_webpage_enabled: true,
    view_as_web_page_text: 'View this email as a web page',
    view_as_web_page_link_text: 'Click here to view as web page',
    email_content: renderedHTML,
    text_content: renderedText,
    email_content_format: 'HTML',
  };
  return req;
}

/*
  run takes as its parameter a context object, which has data about which
  program we wish to render. It should be called by main, which should set this
  context object.
*/
async function run(context) {
  // TODO: render the template and return it
  const { program, programPath, date } = context || {};

  const templateFilePath = getTemplateFilePathFromProgram(program);

  const template = await getDataFromFileAsync(templateFilePath);
  const apiResponse = await getDataByProgramByDateAsync(programPath, date.toISOString());

  const apiData = await parseFetchResponseAsJSONAsync(apiResponse);

  const templateData = transformAPIDataToTemplateData(apiData, context);
  const rendered = renderTemplateFromData(template, templateData);

  await writeDataToFileAsync('test.html', rendered);
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
  return parser;
}

function cli() {
  const p = createArgsParser();
  const args = p.parseArgs();

  const { program: programArg, date: dateArg, lists: listsArg } = args;
  const normalizedProgram = programArg.toLowerCase();
  const lists = validateListsInput(listsArg);

  const context = {
    program: normalizedProgram,
    programPath: getProgramPathFromProgram(normalizedProgram),
    programName: getProgramNameFromProgram(normalizedProgram),
    date: normalizeDate(dateArg),
    lists,
  };
  return run(context);
}

function main(programArg, dateArg, listsArg) {
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
  };
  return run(context);
}

if (!module.parent) {
  cli();
}

module.exports = {
  generateEmail: main,
};
