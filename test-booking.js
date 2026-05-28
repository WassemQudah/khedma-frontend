import fs from 'fs';
import https from 'https';

const token = fs.readFileSync('.temp_token', 'utf8').trim();
const req = https.request('https://khedma1-api-dsc0fbbxd9drhkhd.uaenorth-01.azurewebsites.net/api/Booking/provider/requests', {
  headers: { 'Authorization': `Bearer ${token}` }
}, (res) => {
  let data = '';
  res.on('data', d => data += d);
  res.on('end', () => {
    try {
       const j = JSON.parse(data);
       console.log(Object.keys(j[0] || j.data[0] || {}));
       console.log(j[0] || j.data[0]);
    } catch(e) { console.log(data); }
  });
});
req.end();
