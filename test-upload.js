const fs = require('fs');
const axios = require('axios');

async function loginAndUpload() {
  const loginRes = await axios.post('https://khedma1-api-dsc0fbbxd9drhkhd.uaenorth-01.azurewebsites.net/api/Auth/login', {
    email: 'was@was.com',
    password: '12345678'
  });
  const token = loginRes.data.token;
  
  const FormData = require('form-data');
  const form = new FormData();
  form.append('file', fs.createReadStream('test.png'));
  
  try {
    const uploadRes = await axios.post('https://khedma1-api-dsc0fbbxd9drhkhd.uaenorth-01.azurewebsites.net/api/upload/image', form, {
      headers: {
        'Authorization': `Bearer ${token}`,
        ...form.getHeaders()
      }
    });
    console.log("SUCCESS:", uploadRes.data);
  } catch (err) {
    console.log("ERROR:", err.response?.status, err.response?.data);
  }
}
loginAndUpload();
