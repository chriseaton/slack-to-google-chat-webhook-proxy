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
            if (req.body.attachments && req.body.attachments.length) {
                delete message.text;
                message.cards = [];
                for (let i = 0; i < req.body.attachments.length; i++) {
                    let attach = req.body.attachments[i];
                    let card = {
                        header: {
                            title: attach.title || attach.author_name,
                            subtitle: attach.pretext
                        },
                        sections: []
                    };
                    if (attach.author_icon || attach.footer_icon) {
                        card.header.imageUrl = attach.author_icon || attach.footer_icon;
                        card.header.imageStyle = 'IMAGE';
                    }
                    if (attach.fields && attach.fields.length) {
                        let section = {
                            widgets: []
                        };
                        for (let f of attach.fields) {
                            section.widgets.push({
                                keyValue: {
                                    topLabel: f.title,
                                    content: f.value
                                }
                            });
                        }
                        card.sections.push(section);
                    }
                    if (attach.title_link || (attach.footer && attach.footer.match(/^http.+/i))) {
                        card.sections.push({
                            widgets: [{
                                buttons: [
                                    {
                                        textButton: {
                                            text: 'VIEW',
                                            onClick: {
                                                openLink: {
                                                    url: attach.title_link || attach.footer
                                                }
                                            }
                                        }
                                    }
                                ]
                            }]
                        });
                    }
                    message.cards.push(card);
                }
            }
            //send
            console.info(`Recieved:\n${JSON.stringify(req.body, null, 4)}`);
            console.info(`Sending message:\n${JSON.stringify(message, null, 4)}`);
            axios.post(endpoint, message)
                .then(() => {
                    console.info(`Sent message on "${req.path}" route to channel "${channel || '*'}" endpoint.`);
                    res.status(200).end();
                })
                .catch((error) => {
                    console.error(`Error response from Google Chat (${error.response.status}):\n${JSON.stringify(error.response.data, null, 4)}`);
                    res.status(error.response.status).send(error.response.data);
                });

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
        endpoints: null,
        debug: false
    };
    let config = null;
    if (fs.existsSync('config.yaml')) {
        config = yaml.safeLoad(fs.readFileSync('config.yaml', 'utf8'));
    }
    config = Object.assign(defaultConfig, config);
    config.debug = (config.debug === 'true');
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
