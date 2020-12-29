# Slack to Google Chat WebHook Proxy
This project is a simple server that accepts Slack-formatted webhook requests and transforms them into Google Chat webhook requests. It listens on the configured port and IP address and then forwards a transformed request to the configured Google Chat webhook URL.

This project was created when Slack is well supported in many third-party applications, but Google Chat is relatively new with little to no existing support. This project allows you to simply utilize a Slack-configurable webhook in a third-party application (provided it let's you set a custom URL) and have that webhook request routed to your Google Chat instead.

# Configuration
The proxy is configured using environmental variables and/or a `config.yaml` file, it will also load environmental variables from a `.env` file present in the current directory if it is present.

## YAML File
You can configure the proxy using a `config.yaml` file in the local directory. In the docker container, the full path is `/srv/config.yaml`.
Using the YAML file gives you more flexibility than utilizing the environmental variables because you can setup multiple endpoints with differing
target Google Chat webhooks. 

Each endpoint is defined as a key-value object. The key is the route to accept the slack request, and the value is either an object defining 
key-values of channels and Google Chat endpoints, or just a Google Chat endpoint on it's own. If the value is empty or null, the default Google Chat endpoint (URL)
is used. If you want to define the root route `/`, use an "_" key.

If any value is not found in the YAML file, it will fallback to the environmental variable value (if any), and then to the proxy default (if any).

### Example YAML File A:
The following config file will set a specific port `4321` and host `localhost` to listen on, for *any* route request, then forward to the environmental variable's `GOOGLE_CHAT_URL` defined target.

```
port: 4321
host: localhost
```

### Example YAML File B:
The following config file will set a specific port `3333` and host `192.168.1.1` to listen on, and use a differing webhook URL for different *specific* routes.
In this case, a request to the proxy route `/gotoTeamChannel` will transform and forward to `https://chat.google.com/XXXX123` whereas a request to `/abc1235` would forward to `https://chat.google.com/XXXXZXY`. In the case of the `/choose` route, it will examine the slack request's `channel` value and send to the appropriately matching endpoint.

Any other route will result in a `404` error response. 

```
port: 3333
host: 192.168.1.1
endpoints:
    - gotoTeamChannel: https://chat.google.com/XXXX123
    - choose: 
        Team Channel: https://chat.google.com/XXXXABC
        Tech Notify: https://chat.google.com/XXXX333
    - abc1235: https://chat.google.com/XXXXZXY
```

## Environmental Variables
The following environmental variables are loaded if the values were not found in a `config.yaml` file.

| ENV | Type | Default | Description |
| - | - | - | - |
| HOST | String | 0.0.0.0 | The IP address to listen on. Typically this is "0.0.0.0" for unix-based systems and "localhost" for Microsoft Windows. |
| PORT | Number | 8080 | The port number to listen on for the Slack-formatted webhook request. |
| GOOGLE_CHAT_URL | String | | The Google Chat webhook URL endpoint to send the transformed request to. |

# Running
This project can be run either as a docker container or by simply executing `npm start` to start listening.

# Building
This project uses node.js to run and does not have an explicit build process.

## Docker
This project can be made to run under a docker container (see `Dockerfile` in this project).    
To build the docker image, run:
```sh
docker build -t chriseaton/slack-to-google-chat:latest .
```

If you want to test the docker image, start a container:
```sh
docker run -dp 8080:8080 \
    --name slack_to_google_proxy \
    --env GOOGLE_CHAT_URL="https://chat.google.com/XXXXXX" \
    chriseaton/slack-to-google-chat:latest
```

You can then kill and remove the container by running:
```
docker rm -f slack_to_google_proxy
```

If you are going to publish the image, use:
```
docker push chriseaton/slack-to-google-chat:latest
```

## Code Documentation
You can generate a static JSDoc site under the `docs/` path using the command `npm run docs`.

# Testing
Run `npm test` to run jest unit tests.

Run `npm run lint` to run ESLint, optionally install the Visual Studio Code ESLint extension to have linting issues show in your "Problems" tab and be highlighted.

If you are writing unit tests, you may need to `npm install @types/jest` to get intellisense in Visual Studio Code if for some reason it did not get installed.