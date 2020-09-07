export interface EvmScript {
    address: string;
    calldataLength: string;
    calldata: string;
}

export function generateScript(address: string, encoded: string): EvmScript {
    console.log({
        address,
        encodedLength: encoded.length,
        encoded
    });

    return {
        address,
        calldataLength: encoded.length.toString(),
        calldata: encoded
    }
}

export function encodeScript(evmScript: EvmScript) {
    
}