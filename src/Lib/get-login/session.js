import Logger from "./logger";
import {createWallet} from "./utils";
import EthCrypto from 'eth-crypto';
import {privateToPublic} from 'ethereumjs-util';

export const SESSION_CREATE_WALLET = 'session_create_wallet';
export const SESSION_REGISTER_WALLET = 'session_register_wallet';

export default class Session extends Logger {
    constructor(crypto, contract) {
        super();

        /**
         *
         * @type {crypto}
         */
        this.crypto = crypto;

        /**
         *
         * @type {contract}
         */
        this.contract = contract;
    }

    async createSession(appId, sendBalance = '0.03') {
        const {web3} = this.crypto;

        this.log(SESSION_CREATE_WALLET);
        const wallet = createWallet(web3);
        //console.log(wallet);

        this.log(SESSION_REGISTER_WALLET);
        const privateKey = Buffer.from(this.crypto.getAccount().privateKey.replace('0x', ''), 'hex');
        const publicKey = privateToPublic(privateKey).toString('hex');
        //console.log(privateKey);
        //console.log(publicKey);
        const encrypted = await EthCrypto.encryptWithPublicKey(publicKey, wallet.privateKey);
        const createdSession = await this.contract.createAppSession(appId, wallet.address, encrypted.iv, encrypted.ephemPublicKey, encrypted.ciphertext, encrypted.mac, sendBalance);

        return {wallet, createdSession};
    }

    async getSessionInfo(appId, usernameHash) {
        const encryptedSession = await this.contract.getSession(appId, usernameHash);
        if (!encryptedSession) {
            throw new Error('Session not found');
        }

        encryptedSession.privateKey = await EthCrypto.decryptWithPrivateKey(this.crypto.getAccount().privateKey, encryptedSession.returnValues);

        return encryptedSession;
    }
}
