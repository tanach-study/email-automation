#! /usr/bin/env node

const handlebars = require('handlebars');
const fs = require('fs');
const { ArgumentParser } = require('argparse');
const fetch = require('node-fetch');

/*
  renderTemplateFromData is designed to take in an email template, some data
  to render it with, and simply returns the rendered html.
*/
function renderTemplateFromData(source, data) {
  var template = handlebars.compile(source);
  var html = template(data);
  return html;
}

/*
  getDataFromFileAsync takes as its parameter a file path and returns a promise,
  which, when it returns, returns the data of the file. It can be used to open
  and read an email template file.
*/
function getDataFromFileAsync(file) {
  return new Promise((resolve, reject) => {
    fs.readFile(file, 'utf8', function(err, data) {
      if (err) return reject(err);
      return resolve(data);
    });
  });
}

function getDataByProgramByDateAsync(programPath, date) {
  const url = `https://api.tanachstudy.com/${programPath}/schedule/${date}`;
  return fetch(url);
}

function transformAPIDataToTemplateData(apiData, context) {
  // TODO: pull out values from the response object to pass to the template
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
/*
  run takes as its parameter a context object, which has data about which
  program we wish to render. It should be called by main, which should set this
  context object.
*/
function run(context) {
  // TODO: render the template and return it
  const { program, programPath, date } = context || {};
  const promises = [];

  const templateFilePath = getTemplateFilePathFromProgram(program);

  promises.push(getDataFromFileAsync(templateFilePath));
  promises.push(getDataByProgramByDateAsync(programPath, date.toISOString()));

  Promise.all(promises)
    .then((data) => {
      const template = data[0];
      const apiResponse = data[1];
      apiResponse.json()
        .then((apiData) => {
          const templateData = transformAPIDataToTemplateData(apiData, context);
          const rendered = renderTemplateFromData(template, templateData);
          fs.writeFileSync('test.html', rendered, 'utf-8');
        })
        .catch((jsonParseErr) => {
          throw jsonParseErr;
        });
    })
    .catch((err) => {
      throw err;
    });
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

function normalizeDate(date) {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

function createArgsParser() {
  const parser = new ArgumentParser({
    version: '1.0.0',
    addHelp: true,
    description: 'Generate and schedule email campaigns for all Tanach Study programs'
  });
  parser.addArgument(
    ['-p', '--program'],
    {
      help: 'select which program to run with',
      action: 'store',
      dest: 'program',
      required: true,
    }
  );
  parser.addArgument(
    ['-d', '--date'],
    {
      help: 'set a date for the email',
      action: 'store',
      dest: 'date',
      required: true,
    }
  );
  return parser;
}

function cli() {
  const p = createArgsParser();
  const args = p.parseArgs();

  const { program: programArg, date: dateArg } = args;
  const normalizedProgram = programArg.toLowerCase();

  const context = {
    program: normalizedProgram,
    programPath: getProgramPathFromProgram(normalizedProgram),
    date: normalizeDate(dateArg),
  };
  return run(context);
}

function main(programArg) {
  if (!programArg) {
    throw new Error('must specify program argument');
  }
  const normalizedProgram = programArg.toLowerCase();

  const context = {
    program: normalizedProgram,
    programPath: getProgramPathFromProgram(normalizedProgram),
  };
  return run(context);
}

if (!module.parent) {
  cli();
}

module.exports = {
  generateEmail: main,
}
