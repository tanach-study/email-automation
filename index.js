const handlebars = require('handlebars');

function renderTemplateFromData(source, data) {
  var template = handlebars.compile(source);

  var context = {title: "My New Post", body: "This is my first post!"};
  var html    = template(data);
  return html;
}
console.log(renderTemplateFromData());