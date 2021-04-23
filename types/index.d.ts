import { Client, ResponseType, Strategy, StrategyOptions, UserinfoResponse} from 'openid-client';

interface Options {
    issuerUrl: string;
    clientID: string;
    clientSecret?: string;
    redirectUris?: string[];
    responseTypes?: ResponseType[];
}

interface CurityStrategyOptions<TClient extends Client> extends StrategyOptions<TClient> {
    fallbackToUserInfoRequest?: boolean
}

declare function discoverAndCreateClient(options: Options): Promise<Client>;

declare class CurityStrategy<TUser, TClient extends Client> extends Strategy<TUser, TClient>{
    constructor(options: CurityStrategyOptions<TClient>, verify: (accessToken:string, refreshToken:string, profile: any, callback: (err: any, profile: any) => void) => void);
}

export { CurityStrategy as Strategy, discoverAndCreateClient, Options, CurityStrategyOptions};
