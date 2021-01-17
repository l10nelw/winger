const TAB_PATH = browser.runtime.getURL('../placeholder/tab.html');
const createTabURL = ({ url }, title) => `${TAB_PATH}?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`;

export const isTabURL = url => url.startsWith(TAB_PATH);
export const getTargetURL = tabUrl => decodeURIComponent((new URL(tabUrl)).searchParams.get('url'));

// Open placeholder tab. Must provide `title` because `properties` may not reliably contain title.
export function openTab(properties, title) {
    properties.url = createTabURL(properties, title);
    return browser.tabs.create(properties);
}
