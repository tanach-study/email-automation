#! /usr/bin/env node

const handlebars = require('handlebars');
const fs = require('fs');
const { ArgumentParser } = require('argparse');

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

function getDataByProgramByDateAsync(program, date) {
  // TODO: hit the api with a request to get the data for that date
  // api route is: https://api.tanachstudy.com/${program}/schedule/${date}
  // return fetch...
}

function transformAPIDataToTemplateData(apiData) {
  // TODO: pull out values from the response object to pass to the template
}


/*
  run takes as its parameter a context object, which has data about which
  program we wish to render. It should be called by main, which should set this
  context object.
*/
function run(context) {
  // TODO: get the program name and path to template from context
  // TODO: get the program's template from its file
  // TODO: get the date on which we wish to run this on from context
  // TODO: get the data for the program at the given date from the TS api
  // TODO: render the template and return it
  const { program, programPath } = context || {};


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
  return parser;
}

function cli() {
  const p = createArgsParser();
  const args = p.parseArgs();

  const { program: programArg } = args;
  const normalizedProgram = programArg.toLowerCase();

  const context = {
    program: normalizedProgram,
    programPath: getProgramPathFromProgram(normalizedProgram),
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
