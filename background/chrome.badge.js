import * as Storage from '../storage.js';

//@ (Map(Number:String) | [[Number, String]]), state -> state
export async function update(nameMap) {
    browser.browserAction.setBadgeBackgroundColor({ color: 'white' });
    const transformFn = await createTextTransformer();
    for (let [windowId, text] of nameMap) {
        if (text)
            text = transformFn(text);
        browser.browserAction.setBadgeText({ windowId, text });
    }
}

//@ state -> (Function)
async function createTextTransformer() {
    const { badge_show_emoji_first, badge_regex, badge_regex_gflag } = await Storage.getDict(['badge_show_emoji_first', 'badge_regex', 'badge_regex_gflag']);
    const regexObj = badge_regex && new RegExp(badge_regex, badge_regex_gflag ? 'g' : undefined);

    if (badge_show_emoji_first)
        return regexObj ?
            (text => {
                const [emojis, nonEmojis] = extractEmojis(text);
                return emojis + applyRegex(regexObj, nonEmojis);
            }) :
            (text => extractEmojis(text).join(''));

    if (regexObj)
        return (text => applyRegex(regexObj, text));

    return (text => text);
}

//@ (String) -> ([String, String])
function extractEmojis(text) {
    const emojis = text.match(EMOJI_REGEX)?.join('') ?? '';
    const others = text.replace(EMOJI_REGEX, '');
    return [emojis, others];
}
const EMOJI_REGEX = /[\p{Extended_Pictographic}]/ug; // /[\p{RGI_Emoji}]/vg;

//@ (Object, String) -> (String)
const applyRegex = (regexObj, text) => text.match(regexObj).join('');
