const handlebars = require('handlebars');
const fs = require('fs')

function renderTemplateFromData(source, data) {
  var template = handlebars.compile(source);

  var context = {title: "My New Post", body: "This is my first post!"};
  var html    = template(data);
  return html;
}
//console.log(renderTemplateFromData());

function getMishnaEmailTemplateFromFile() {
  const file = './templates/ms.html';

  return new Promise((resolve, reject) => {
    fs.readFile(file, 'utf8', function(err, data) {
      if (err) return reject(err);
      return resolve(data);
    });
  });
}
getMishnaEmailTemplateFromFile()
.then(data => console.log(data))
.catch(err => console.error(err));

/*
function runMS() {
  const msTemplate = getMishnaEmailTemplateFromFile();
  const msData = getMishnaData();
  const rendered = renderTemplateFromData(msTemplate, msData);
}
*/