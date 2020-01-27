class GetLoginApi {
    appId = null;
    baseUrl = null;
    pluginUrl = null;
    authUrl = null;
    redirectUrl = null;
    iframe = null;
    isInitInProgress = false;
    accessToken = '';
    clientAbi = [];

    /**
     * In seconds
     * @type {number}
     */
    sendMessageTimeout = 60;


    isReady() {
        return !!this.iframe;
    }

    _randomUid() {
        return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    }

    _sendMessage(accessToken, method, params = null) {
        //console.log('call ' + method);
        if (!this.iframe) {
            throw new Error('Empty iframe');
        }

        const id = this._randomUid();
        return new Promise((resolve, reject) => {
            let timeout = setTimeout(() => {
                reject('Timeout error');
            }, this.sendMessageTimeout * 1000);

            const listener = (event) => {
                if (typeof event.data !== 'object' || event.data.id !== id) {
                    return;
                }

                clearTimeout(timeout);
                window.removeEventListener('message', listener);

                if (event.data.result) {
                    resolve(event.data.result);
                } else {
                    reject(event.data.error ? event.data.error : 'Unknown error');
                }
            };

            window.addEventListener('message', listener);
            const message = {
                id,
                app: 'get_login',
                appId: this.appId,
                accessToken,
                method,
                params
            };

            this.iframe.postMessage(message, this.pluginUrl);
        });
    }

    _getWindow() {
        return new Promise((resolve => {
            let interval = setInterval(() => {
                if (window) {
                    clearInterval(interval);
                    resolve(window);
                }
            }, 100);
        }));
    }

    setClientAbi(abi) {
        this.clientAbi = abi;
    }

    getClientAbi() {
        return this.clientAbi;
    }

    getAuthorizeUrl(appId = this.appId, redirectUrl = this.redirectUrl) {
        [appId, this.authUrl, redirectUrl].forEach(item => {
            if (!item) {
                throw new Error('Incorrect params');
            }
        });

        return `${this.authUrl}?client_id=${appId}&response_type=id_token&redirect_uri=${redirectUrl}`;
    }

    async init(appId, baseApiUrl, redirectUrl) {
        [appId, baseApiUrl, redirectUrl].forEach(item => {
            if (!item) {
                throw new Error('Incorrect params');
            }
        });

        if (this.isInitInProgress) {
            throw new Error('Init in progress');
        }

        if (this.iframe) {
            throw new Error('Already init');
        }

        this.appId = appId;
        this.baseUrl = baseApiUrl;
        this.pluginUrl = `${baseApiUrl}xplugin?client_id=${appId}`;
        this.authUrl = `${baseApiUrl}xauthorize`;
        this.redirectUrl = redirectUrl;
        let isFrameLoaded = false;
        let answerData = {};
        const waitFrameLoaded = async () => {
            return new Promise((resolve, reject) => {
                let interval = setInterval(() => {
                    if (isFrameLoaded) {
                        clearInterval(interval);
                        resolve();
                    }
                }, 100);
            });
        };

        try {
            this.isInitInProgress = true;
            if (!this.pluginUrl) {
                throw new Error('Incorrect url');
            }

            const window = await this._getWindow();
            const listener = (event) => {
                const data = event.data;
                if (typeof data === 'object' && data.type === 'get_login_init') {
                    answerData = {...data, authorize_url: this.getAuthorizeUrl()};
                    isFrameLoaded = true;
                    this.iframe = iframe.contentWindow;
                    window.removeEventListener('message', listener);
                }
            };
            window.addEventListener('message', listener);
            const iframe = document.createElement('iframe');
            iframe.style.display = "none";
            iframe.src = this.pluginUrl;
            document.body.appendChild(iframe);
        } catch (e) {
            this.isInitInProgress = false;
            throw e;
        }

        await waitFrameLoaded();

        this.accessToken = answerData.access_token;
        return {
            result: true,
            data: answerData
        };
    }

    async getUserInfo() {
        return this._sendMessage(this.accessToken, 'getUserInfo');
    }

    async callContractMethod(address, method, params) {
        const abi = this.getClientAbi();
        if (!abi) {
            throw new Error('Empty abi');
        }

        return this._sendMessage(this.accessToken, 'callContractMethod', {
            abi: this.getClientAbi(),
            address,
            method,
            params
        });
    }

    async sendTransaction(address, method, params) {
        const abi = this.getClientAbi();
        if (!abi) {
            throw new Error('Empty abi');
        }

        return this._sendMessage(this.accessToken, 'sendTransaction', {
            abi: this.getClientAbi(),
            address,
            method,
            params
        });
    }
}

window.getLoginApi = new GetLoginApi();
