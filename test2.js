
const cheerio = require('cheerio-without-node-native');
const fs = require('fs');
fetch('https://animexin.dev/soul-land-s2/')
  .then(res => res.text())
  .then(html => {
    fs.writeFileSync('animexin_series.html', html);
    const search = cheerio.load(html);
    search('.eplister ul li a').each((i, el) => {
        console.log(search(el).find('.epl-num').text() || search(el).text());
    });
  });

