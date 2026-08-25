
const cheerio = require('cheerio-without-node-native');
const fs = require('fs');
const html = fs.readFileSync('animexin_soulland.html', 'utf8');
const search = cheerio.load(html);
search('.bsx a').each((i, el) => {
    console.log(search(el).attr('href'));
});

