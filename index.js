/* eslint-disable no-console */
import fs from 'fs';
import dotenv from 'dotenv';
import express from 'express';
import bodyParser from 'body-parser';
import yaml from 'js-yaml';
import axios from 'axios';
const { version, author } = JSON.parse(fs.readFileSync('./package.json', 'utf8'));

dotenv.config();
const app = express();

function handleRequest(req, res, target) {
    let endpoint = null;
    let channel = null;
    if (req.body) {
        if (typeof target === 'string') {
            endpoint = target;
        } else if (typeof target === 'object' && typeof req.body.channel === 'string') {
            channel = req.body.channel;
            endpoint = target[req.body.channel];
        }
        if (endpoint) {
            //transform
            let message = {
                text: req.body.text
            };
            console.info(`Sent message on "${req.path}" route to channel "${channel || '*'}" endpoint.`);
            //send
            axios.post(endpoint, message)
                .then(() => res.status(200).end())
                .catch((error) => res.status(error.response.status).send(error.response.data));
        } else {
            res.status(500).send('500: No endpoints configured on server for this endpoint route.');
        }
    } else {
        res.status(200).end();
    }

}

(function init() {
    let defaultConfig = {
        host: process.env.HOST || '0.0.0.0',
        port: process.env.PORT || 8080,
        defaultEndpoint: process.env.GOOGLE_CHAT_URL,
        endpoints: null
    };
    let config = null;
    if (fs.existsSync('config.yaml')) {
        config = yaml.safeLoad(fs.readFileSync('config.yaml', 'utf8'));
    }
    config = Object.assign(defaultConfig, config);
    console.info(`Slack to Google Chat WebHook Proxy: v.${version}, ${author.url}`);
    //middleware
    app.use(bodyParser.json());
    //handle favicon
    app.get('/favicon.ico', (req, res) => {
        fs.createReadStream('favicon.ico').pipe(res);
    });
    //setup endpoint routes
    if (config.endpoints && config.endpoints.length) {
        for (let r of config.endpoints) {
            let key = null;
            if (typeof r === 'string') {
                key = r;
            } else {
                let keys = Object.getOwnPropertyNames(r);
                if (keys.length === 1) {
                    key = keys[0];
                } else {
                    console.error(`Invalid endpoint route "${keys.join(', ')}". Only one route name should be specified per endpoint.`);
                    return 1;
                }
            }
            let scopedTarget = r[key] || config.defaultEndpoint;
            if (key === '_') {
                key = '';
            }
            console.log(key, scopedTarget);
            app.post('/' + key, (req, res) => {
                if (scopedTarget) {
                    handleRequest(req, res, scopedTarget);
                } else {
                    res.status(500).send('500: No endpoints configured on server for this endpoint route.');
                }
            });
        }
        //setup 404 fallback
        app.get('*', (req, res) => {
            res.status(404).send('404: The endpoint route specified was not found.');
        });
    } else {
        //catch-all mode (any route will forward)
        app.post('*', (req, res) => {
            if (config.defaultEndpoint) {
                handleRequest(req, res, config.defaultEndpoint);
            } else {
                res.status(500).send('500: No endpoints configured on server.');
            }
        });
    }
    //start listening
    app.listen(config.port, config.host, () => console.info(`Listening on: http://${config.host}:${config.port}`));
})();
