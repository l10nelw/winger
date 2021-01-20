const PATH = browser.runtime.getURL('../placeholder/tab.html');
const createPlaceholderURL = ({ url }, title) => `${PATH}?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`;

export const isPlaceholderURL = url => url.startsWith(PATH);
export const getTargetURL = placeholderUrl => decodeURIComponent((new URL(placeholderUrl)).searchParams.get('url'));

// Open placeholder tab. Must provide `title` because `properties` may not reliably contain title.
export function openTab(properties, title) {
    properties.url = createPlaceholderURL(properties, title);
    return browser.tabs.create(properties);
}
