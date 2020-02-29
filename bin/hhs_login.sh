#!/bin/bash
# Need to install ack
mkdir -p tmp

# Get these environment variables
HHS_EMAIL=$(ack "HHS_EMAIL=(.*)" .env --output '$1')
HHS_PASSWORD=$(ack "HHS_PASSWORD=(.*)" .env --output '$1')
HHS_BASE_URI=$(ack "HHS_BASE_URI=(.*)" .env --output '$1')

csrftoken=$(curl "${HHS_BASE_URI}/accounts/login/" --cookie-jar tmp/hhs_login_cookies.txt | ack "name='csrfmiddlewaretoken' value\='(.*)'" --output '$1')
echo $csrftoken
curl "${HHS_BASE_URI}/accounts/login/" \
    --cookie-jar tmp/hhs_authentication_cookies.txt \
    -H 'Connection: keep-alive' \
    -H 'Cache-Control: max-age=0' \
    -H "Origin: ${HHS_BASE_URI}" \
    -H 'Upgrade-Insecure-Requests: 1' \
    -H 'Content-Type: application/x-www-form-urlencoded' \
    -H 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/78.0.3904.97 Safari/537.36' \
    -H 'Sec-Fetch-User: ?1' \
    -H 'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3' \
    -H 'Sec-Fetch-Site: same-origin' \
    -H 'Sec-Fetch-Mode: navigate' \
    -H "Referer: ${HHS_BASE_URI}/accounts/login/" \
    -H 'Accept-Encoding: gzip, deflate, br' \
    -H 'Accept-Language: en-US,en;q=0.9' \
    -H 'dnt: 1' \
    --cookie tmp/hhs_login_cookies.txt \
    --data-urlencode "email=${HHS_EMAIL}" \
    --data "csrfmiddlewaretoken=${csrftoken}&password=${HHS_PASSWORD}" \
    --compressed \
    --dump-header '/tmp/gloopo.txt'