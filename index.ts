import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import UserAgent from 'user-agents';
import fs from 'fs';

// Initialize Stealth Plugin
puppeteer.use(StealthPlugin());

const configStr = fs.readFileSync('./config.json', 'utf8');
const config = JSON.parse(configStr);

// Helper: Random Integer
const getRandomInt = (min: number, max: number) => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
};

// Helper: Sleep
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper: Random sleep to simulate human interaction
const humanSleep = async (min = 500, max = 1500) => {
    await sleep(getRandomInt(min, max));
};

// State to track choices for logic consistency
const currentChoices: { [key: string]: string } = {};

async function runBot() {
    console.log(`[INIT] Starting Google Forms Automation Bot...`);
    console.log(`[CONFIG] Target: ${config.requestsTarget} submissions.`);

    let successfulSubmissions = 0;

    while (successfulSubmissions < config.requestsTarget) {
        const proxy = config.proxies[getRandomInt(0, config.proxies.length - 1)];
        const userAgent = new UserAgent({ deviceCategory: 'desktop' }).toString();

        // Clear choices for new session
        for (const key in currentChoices) delete currentChoices[key];

        console.log(`\n[ITERATION ${successfulSubmissions + 1}] Proxy: ${proxy} | UA: ${userAgent.substring(0, 30)}...`);

        const browser = await puppeteer.launch({
            headless: false,
            args: [
                `--no-sandbox`,
                `--disable-setuid-sandbox`,
                `--window-size=1920,1080`
            ],
            defaultViewport: null
        });

        const page = await browser.newPage();
        await page.setUserAgent(userAgent);
        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => false });
        });

        try {
            console.log(`[NAV] Navigating to form...`);
            await page.goto(config.targetUrl, { waitUntil: 'networkidle2', timeout: 60000 });
            await humanSleep(2000, 5000);

            // --- 1. FILL DEMOGRAPHICS (Generic Logic Engine) ---
            console.log(`[ACTION] Filling demographics...`);

            // Define question order (important for logic flow)
            const questionKeys = ['gender', 'age', 'marital_status', 'education', 'department'];

            for (const key of questionKeys) {
                if (!config.questions[key]) continue;

                const qConfig = config.questions[key];
                const entryId = qConfig.id;

                // 1. Check Forced Values (Global Overrides)
                let choice = config.forcedValues && config.forcedValues[entryId];

                // 2. If no force, check Conditional Logic Rules
                if (!choice && config.logicRules) {
                    for (const rule of config.logicRules) {
                        // If the trigger/condition matches what we have already selected
                        if (currentChoices[rule.triggerId] === rule.triggerValue && rule.actionId === entryId) {
                            choice = rule.actionValue;
                            console.log(`[LOGIC] Rule Applied: "If ${rule.triggerValue}" then "${choice}" for ${key}`);
                            break;
                        }
                    }
                }

                // Helper: Weighted Random Choice
                const getWeightedChoice = (options: any[]) => {
                    // If options are strings, pick random
                    if (typeof options[0] === 'string') {
                        return options[Math.floor(Math.random() * options.length)];
                    }

                    // If options are objects with weights
                    const totalWeight = options.reduce((sum: number, opt: any) => sum + (opt.weight || 0), 0);
                    let random = Math.random() * totalWeight;

                    for (const opt of options) {
                        if (random < opt.weight) {
                            return opt.value;
                        }
                        random -= opt.weight;
                    }
                    return options[0].value; // Fallback
                };

                // ... inside runBot ...
                // 3. Fallback to Random / Weighted
                if (!choice) {
                    if (qConfig.options) {
                        // If it has options (radio OR text with weighted options), use them
                        choice = getWeightedChoice(qConfig.options);
                    } else if (qConfig.type === 'text') {
                        choice = qConfig.value;
                    }
                }


                // Store choice for future logic checks
                currentChoices[entryId] = choice;

                // Perform Interaction
                if (qConfig.type === 'radio') {
                    await selectRadioOption(page, entryId, choice, qConfig.questionText);
                } else if (qConfig.type === 'text') {
                    await typeText(page, entryId, choice);
                }
            }

            // --- 2. FILL LIKERT SCALES (Robust Question-Based Loop) ---
            console.log(`[ACTION] Filling Likert scales...`);

            // Collect Demographic IDs to SKIP
            const DEMOGRAPHIC_IDS = Object.values(config.questions).map((q: any) => q.id);

            // Get all question containers first
            const questions = await page.$$('[role="listitem"]');

            for (const q of questions) {
                // Check Entry ID first to see if we should skip
                const input = await q.$('input[type="hidden"]');
                let entryId = null;
                if (input) {
                    entryId = await input.evaluate((el) => el.getAttribute('name'));
                }

                if (entryId && DEMOGRAPHIC_IDS.includes(entryId)) {
                    // console.log(`[SKIP] ID ${entryId} is demographic. Skipping.`);
                    continue;
                }

                const radioGroup = await q.$('div[role="radiogroup"]');
                if (!radioGroup) continue;

                // Check if already filled (Double check)
                const isFilled = await radioGroup.$('div[aria-checked="true"]');
                if (isFilled) continue;

                // Scroll question into view (Crucial for Google Forms lazy loading/visibility)
                try {
                    await q.evaluate((el: Element) => el.scrollIntoView({ block: 'center' }));
                } catch (e) { console.log('Scroll failed', e); }

                await humanSleep(300, 700);

                const options = await radioGroup.$$('div[role="radio"]');

                // Skip demographics (Likert usually has 5, demographics have 2-4 or 6+)
                if (options.length !== 5) {
                    continue;
                }

                // Weighted Randomness for Likert (Skew Positive)
                const rand = Math.random();
                let index = 0;
                // 2% Negative, 3% Disagree, 5% Neutral, 40% Agree, 50% Strongly Agree
                if (rand < 0.02) index = 0;
                else if (rand < 0.05) index = 1;
                else if (rand < 0.10) index = 2;
                else if (rand < 0.50) index = 3;
                else index = 4;

                if (index >= options.length) index = options.length - 1;

                await options[index].click();
                await humanSleep(300, 600);
            }

            // --- 3. SUBMIT ---
            console.log(`[ACTION] Submitting form...`);
            // Take a screenshot before submitting to debug any validation errors
            await page.screenshot({ path: `debug-before-submit-${Date.now()}.png` });

            const submitBtn = await page.$('div[role="button"][aria-label="Gönder"], div[role="button"][aria-label="Submit"]');

            let clicked = false;
            if (submitBtn) {
                await submitBtn.click();
                clicked = true;
            } else {
                // Fallback: looking for span text inside
                const spans = await page.$$('span');
                for (const span of spans) {
                    const text = await page.evaluate((el: HTMLElement) => el.innerText, span);
                    if (text === 'Gönder' || text === 'Submit') {
                        const btn = await page.evaluateHandle((el: HTMLElement) => el.closest('div[role="button"]'), span);
                        if (btn) {
                            await (btn as any).click();
                            clicked = true;
                        }
                        break;
                    }
                }
            }

            if (clicked) {
                console.log('[ACTION] Click command sent.');
            } else {
                console.error('[ERROR] Submit button not found!');
            }

            // Verification
            try {
                await page.waitForSelector('.freebirdFormviewerViewResponseConfirmationMessage', { timeout: 10000 });
                successfulSubmissions++;
                console.log(`[SUCCESS] Form Submitted Successfully! (${successfulSubmissions}/${config.requestsTarget})`);
            } catch (e) {
                console.warn('[WARN] Confirmation message not found. Checking for errors...');
                await page.screenshot({ path: `error-confirmation-${Date.now()}.png` });
                // Check if we are still on the form page (implies validation error)
                throw new Error('Form submission failed or timed out.');
            }

        } catch (e) {
            console.error(`[ERROR] Iteration failed:`, e);
        } finally {
            await browser.close();
        }

        // --- 4. WAIT LOOP ---
        if (successfulSubmissions < config.requestsTarget) {
            const delayMinutes = Math.random() * (config.timing.maxDelayMinutes - config.timing.minDelayMinutes) + config.timing.minDelayMinutes;
            const delayMs = delayMinutes * 60 * 1000;
            console.log(`[WAIT] Sleeping for ${delayMinutes.toFixed(2)} minutes (${(delayMs / 1000).toFixed(0)}s)...`);
            await sleep(delayMs);
        }
    }
}

// --- HELPERS ---

async function selectRadioOption(page: any, entryId: string, optionTextOrValue: string, questionText?: string) {
    try {
        console.log(`[RADIO] Attempting to select "${optionTextOrValue}" for ${questionText || entryId}`);

        // Strategy: Find Heading -> Find Container -> Find Option
        const found = await page.evaluate(async (qText: string, optText: string, id: string) => {
            let container: Element | null = null;

            // 1. Try to find by Question Text (Strongest)
            if (qText) {
                const headings = Array.from(document.querySelectorAll('[role="heading"], .M7eMe'));
                // normalize
                const normalize = (t: string) => t.toLowerCase().replace(/\s+/g, '').replace('*', '');

                const target = normalize(qText);
                const heading = headings.find(h => {
                    return normalize((h as HTMLElement).innerText).includes(target);
                });

                if (heading) {
                    container = heading.closest('[role="listitem"]');
                }
            }

            // 2. Fallback to Entry ID if text failed
            if (!container && id) {
                const hiddenInput = document.querySelector(`input[name="${id}"]`);
                if (hiddenInput) {
                    container = hiddenInput.closest('[role="listitem"]');
                }
            }

            if (container) {
                // Scroll into view
                container.scrollIntoView({ block: 'center', behavior: 'instant' });

                const options = Array.from(container.querySelectorAll('div[role="radio"], label'));
                for (const opt of options) {
                    const el = opt as HTMLElement;
                    const elText = el.innerText.trim();
                    const elVal = el.getAttribute('data-value');

                    // Specific check for "65 yaş ve üstü" vs "65+"
                    // Config says "18-24", Form has "18-24" -> match.
                    if (elText === optText || elVal === optText || elText.startsWith(optText)) {
                        el.click();
                        return true;
                    }
                }
            }
            return false;
        }, questionText || "", optionTextOrValue, entryId);

        if (found) {
            await humanSleep(500, 1000);
            return;
        }

        console.warn(`[WARN] Radio option '${optionTextOrValue}' NOT found for ${questionText || entryId}.`);

    } catch (e) {
        console.error(`Error selecting ${entryId}:`, e);
    }
}

async function typeText(page: any, entryId: string, text: string) {
    try {
        console.log(`[TEXT] Attempting to type "${text}" for ${entryId}`);

        // Strategy 1: Specific Google Forms Input Class (often .whsOnd) with name
        const inputSelector = `input[name="${entryId}"], textarea[name="${entryId}"]`;
        const element = await page.$(inputSelector);

        if (element) {
            try {
                // Scroll into view
                await page.evaluate((el: HTMLElement) => el.scrollIntoView({ block: 'center' }), element);
                await humanSleep(200, 500);

                // Check if visible
                const isVisible = await page.evaluate((el: HTMLElement) => {
                    const style = window.getComputedStyle(el);
                    return style.display !== 'none' && style.visibility !== 'hidden' && (el.offsetWidth > 0 || el.offsetHeight > 0);
                }, element);

                if (isVisible) {
                    await element.click();
                    // clear value
                    await page.evaluate((el: any) => el.value = '', element);
                    await element.type(text, { delay: getRandomInt(50, 150) });
                    return;
                } else {
                    console.log(`[DEBUG] Input ${entryId} found but not visible. Trying container strategy.`);
                }
            } catch (e) {
                console.log(`[DEBUG] Standard click/type failed for ${entryId}: ${e}`);
            }
        }

        // Strategy 2: Find Question Text -> Find Input in Container
        const questionText = "Bölüm / Anabilim Dalı"; // We know this specific one is problematic
        await page.evaluate(async (qText: string, typeValue: string) => {
            // Find all headings
            const headings = Array.from(document.querySelectorAll('[role="heading"], .M7eMe'));
            const heading = headings.find(h => (h as HTMLElement).innerText.includes(qText));

            if (heading) {
                const container = heading.closest('[role="listitem"]');
                if (container) {
                    const input = container.querySelector('input[type="text"], textarea') as HTMLInputElement;
                    if (input) {
                        input.focus();
                        input.value = ''; // clear using JS first
                        // We can't type effectively from evaluate, but we can set value. 
                        // However, React/Angular forms might not detect change. 
                        // Best to focus here, then return true to puppeteer to type.
                        input.click();
                    }
                }
            }
        }, questionText, text);

        // After execute, we assume focus is set. Type blindly into focused element.
        await page.keyboard.type(text, { delay: getRandomInt(50, 150) });
        await humanSleep(500, 1000);

    } catch (e) {
        console.error(`Error typing into ${entryId}:`, e);
    }
}

runBot();
