const request = require('request');
require('dotenv').config();
require('request-to-curl');

const hhsLoginCookieJar = request.jar();

const getLoginCsrfToken = (jar) => {
    console.log('getting token')
    return new Promise((resolve) => {
        request({
            method: 'GET',
            uri: `${process.env.HHS_BASE_URI}/accounts/login`,
            jar: jar,
            forever: true
        }, (error, response, body) => {
            if (error) {
                console.log('Error getting CSRF token', error);
            }

            const csrfTokenRegExp = RegExp("name='csrfmiddlewaretoken' value\='(.*)'", 'g')
            const csrfToken = csrfTokenRegExp.exec(body)[1];
            resolve(csrfToken);
        });
    })
}

const login = (jar) => {
    return getLoginCsrfToken(hhsLoginCookieJar)
        .then((csrfToken) => {
            // console.log('jar', jar)
            console.log(jar.getCookieString(`${process.env.HHS_BASE_URI}/accounts/login`))

            return new Promise((resolve) => {
                request({
                    method: 'POST',
                    uri: `${process.env.HHS_BASE_URI}/accounts/login`,
                    // cookie: jar.getCookieString(`${process.env.HHS_BASE_URI}/accounts/login`),
                    jar: jar,
                    forever: true,
                    headers: {
                        'Referer': `${process.env.HHS_BASE_URI}/accounts/login/`,
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3',
                        'Upgrade-Insecure-Requests': '1',
                        'Cache-Control': 'max-age=0',
                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/78.0.3904.97 Safari/537.36',
                        'Sec-Fetch-User': '?1',
                        'Sec-Fetch-Site': 'same-origin',
                        'Accept-Encoding': 'gzip, deflate, br',
                        'Accept-Language': 'en-US,en;q=0.9',
                        'dnt': '1',
                        'cookie': jar.getCookieString(`${process.env.HHS_BASE_URI}/accounts/login`)
                    },
                    form: {
                        email: process.env.HHS_EMAIL,
                        password: process.env.HHS_PASSWORD,
                        csrfmiddlewaretoken: csrfToken
                    }
                }, (error, response) => {
                    if (error) {
                        console.log('Error getting CSRF token', error);
                    }

                    console.log('REQQ', response.request.req.toCurl())
                    // console.log(response)
                    // console.log('jarrr', jar)

                    resolve(jar);
                });
            })
        });
}

module.exports = {
    login: () => {
        return login(hhsLoginCookieJar);
    } 
};