
/**
 -------------------------------------------------------------------------------------------------------------------------------
  This file provides a custom codec boilerplate that handle json streaming data.
  For further information, select 'Help | Components Help | Components v3' main menu in the Designer.
 -------------------------------------------------------------------------------------------------------------------------------
*/
import { AbstractCodec, bufferOrStringDataType, stringDataType } from './components/@ti/gc-target-configuration/lib/TargetConfiguration';
import { streamingCodecDataType } from './components/@ti/gc-model-streaming/lib/StreamingDataModel';

/**
 * To use this 'custom' codec in the application:
 *
 * Include the following script tag at the top of the index.gui file and change 'this_codec_filename' to the name of this file.
 * <script type="module" src="./this_codec_filename.js"></script>
 *
 * Adjust or add 'the gc-target-connection-manager' tag to include 'custom' id in the active-configuration attribute as follow.
 * <gc-target-connection-manager id="manager" active-configuration="usb+cr+custom+streaming"></gc-target-connection-manager>
 */
export class Codec extends AbstractCodec {
    constructor(params = {}) {
        super(params.id || 'custom', bufferOrStringDataType, stringDataType, streamingCodecDataType, streamingCodecDataType);
        this.params = params;
    }

    /**
     * Encodes data and send it to the next encoder.
     *
     * @param {streamingCodecDataType} data data to be send to the next encoder
     */
    encode(data) {
        this.targetEncoder.encode(JSON.stringify(data));
    }

    /**
     * Decodes data and send it to the next decoder.
     *
     * @param {bufferOrStringDataType} data data received from the previous decoder
     */
    decode(data) {
        let message;

        try {
            message = typeof data === 'string' ? data : String.fromCharCode(...data);
        } catch (e) {
            return Error('Error converting buffer to string.');
        }

        try {
            // remove any leading or trailing garbage characters
            message = message.substring(message.indexOf('{'), message.lastIndexOf('}') + 1);
            this.targetDecoder.decode(JSON.parse(message));
            return true;

        } catch (e) {
            return Error(`Received bad JSON data string: ${message}.`);
        }
    }
}

// Create a new instance of the codec
new Codec();