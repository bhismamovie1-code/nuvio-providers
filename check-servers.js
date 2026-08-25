
const cheerio = require('cheerio-without-node-native');
fetch('https://animexin.dev/soul-land-2-the-peerless-tang-sect-episode-1-indonesia-english-sub/')
  .then(res => res.text())
  .then(html => {
    const search = cheerio.load(html);
    search('.mobius select option, #server option, .server option, .mobius .mirror option').each((i, el) => {
        console.log(search(el).text().trim());
        console.log(search(el).attr('value'));
    });
  });

