const fs = require('fs');
const path = require('path');

const files = [
  { src: 'index.html', dest: 'views/index.ejs' },
  { src: 'invoice.html', dest: 'views/invoice.ejs' },
  { src: 'SGJASH.html', dest: 'views/journals/SGJASH.ejs' },
  { src: 'SGJETR.html', dest: 'views/journals/SGJETR.ejs' },
  { src: 'SGJPLS.html', dest: 'views/journals/SGJPLS.ejs' },
  { src: 'SGJSSH.html', dest: 'views/journals/SGJSSH.ejs' },
  { src: 'SGJVSR.html', dest: 'views/journals/SGJVSR.ejs' },
  { src: 'SGMRJ.html', dest: 'views/journals/SGMRJ.ejs' },
  { src: 'pages/about.html', dest: 'views/pages/about.ejs' },
  { src: 'pages/contact.html', dest: 'views/pages/contact.ejs' },
  { src: 'pages/guidelines.html', dest: 'views/pages/guidelines.ejs' },
  { src: 'pages/issn.html', dest: 'views/pages/issn.ejs' },
  { src: 'pages/journals.html', dest: 'views/pages/journals.ejs' },
  { src: 'pages/services.html', dest: 'views/pages/services.ejs' },
  { src: 'pages/submit.html', dest: 'views/pages/submit.ejs' }
];

files.forEach(({ src, dest }) => {
  if (fs.existsSync(src)) {
    let content = fs.readFileSync(src, 'utf8');

    // Extract content between </header> and <footer
    const match = content.match(/<\/header>([\s\S]*?)<footer class="main-footer">/);
    if (match) {
      let bodyContent = match[1];

      // Fix links: remove .html
      bodyContent = bodyContent.replace(/href="([^"]+)\.html"/g, (fullMatch, p1) => {
        // don't touch external links if they have .html, but usually internal
        if (p1.includes('http')) return fullMatch;
        // Handle ../ and pages/
        let newLink = p1.replace('../', '/').replace('pages/', '/');
        // if it's index, route to /
        if (newLink === 'index' || newLink === '/index') newLink = '';
        if (!newLink.startsWith('/')) newLink = '/' + newLink;
        return `href="${newLink}"`;
      });

      // Fix assets
      bodyContent = bodyContent.replace(/src="\.\.\//g, 'src="/');
      bodyContent = bodyContent.replace(/href="\.\.\//g, 'href="/');
      
      const ejsContent = `<%- include('${dest.includes('partials') ? '' : dest.includes('pages/') || dest.includes('journals/') ? '../' : ''}partials/header') %>\n` + 
                         bodyContent + 
                         `\n<%- include('${dest.includes('partials') ? '' : dest.includes('pages/') || dest.includes('journals/') ? '../' : ''}partials/footer') %>`;
      
      fs.writeFileSync(dest, ejsContent);
      console.log(`Converted ${src} to ${dest}`);
    } else {
      console.log(`Could not match header/footer in ${src}`);
    }
  } else {
    console.log(`${src} not found`);
  }
});
