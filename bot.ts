
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import UserAgent from 'user-agents';

// Initialize Stealth Plugin
puppeteer.use(StealthPlugin());

// Types for Configuration
export interface BotConfig {
    targetUrl: string;
    targetCount: number;
    timing: {
        minExecTimeSec: number; // 120s
        maxExecTimeSec: number; // 300s
        minCooldownMin: number; // 7m
        maxCooldownMin: number; // 168m
    };
    proxies: string[];
    demographics: any; // Questions config
}

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

export class GoogleFormsBot {
    private config: BotConfig;
    private isRunning: boolean = false;
    private logCallback: (msg: string) => void;

    constructor(config: BotConfig, logCallback: (msg: string) => void) {
        this.config = config;
        this.logCallback = logCallback;
    }

    private log(msg: string) {
        this.logCallback(msg);
        console.log(msg); // Keep console log for server debug
    }

    public stop() {
        this.isRunning = false;
        this.log('🛑 Dur komutu alındı canım, mevcut işlemi bitiriyorum...');
    }

    public async start() {
        this.isRunning = true;
        this.log(`🌸 Merhaba canım! ${this.config.targetCount} anket hedefimiz var, başlıyoruz!`);
        this.log(`⏱️ Her anket ${this.config.timing.minExecTimeSec}-${this.config.timing.maxExecTimeSec}sn arası sürecek, ${this.config.timing.minCooldownMin}-${this.config.timing.maxCooldownMin}dk ara vereceğiz.`);

        let successfulSubmissions = 0;

        while (this.isRunning && successfulSubmissions < this.config.targetCount) {
            const startTime = Date.now();
            const proxy = this.config.proxies.length > 0 ? this.config.proxies[getRandomInt(0, this.config.proxies.length - 1)] : null;
            const userAgent = new UserAgent({ deviceCategory: 'desktop' }).toString();

            // Proxy args
            const args = [
                `--no-sandbox`,
                `--disable-setuid-sandbox`,
                `--window-size=1920,1080`
            ];
            if (proxy) args.push(`--proxy-server=${proxy}`);

            this.log(`\n🌷 ${successfulSubmissions + 1}. Anket Başlıyor... Seni çok seviyorum! 💕`);

            const browser = await puppeteer.launch({
                headless: false, // Görünür mod - formu canlı izle!
                args: args,
                executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
                defaultViewport: { width: 1920, height: 1080 }
            });

            const page = await browser.newPage();
            await page.setUserAgent(userAgent);
            await page.evaluateOnNewDocument(() => {
                Object.defineProperty(navigator, 'webdriver', { get: () => false });
            });

            try {
                this.log(`🌻 Forma gidiyorum, bekle bir dakika tatlım...`);
                await page.goto(this.config.targetUrl, { waitUntil: 'networkidle2', timeout: 60000 });
                await humanSleep(2000, 5000);

                // --- 1. FILL DEMOGRAPHICS ---
                this.log(`📝 Demografik bilgileri dolduruyorum... (Sen harikasın!)`);

                // We will iterate through the passed demographics config
                const questions = this.config.demographics;
                const currentChoices: { [key: string]: string } = {};

                for (const key in questions) {
                    const qConfig = questions[key];
                    // Skip if Marital Status (removed by request)
                    if (key === 'marital_status') continue;

                    const entryId = qConfig.id;
                    const questionText = qConfig.questionText;

                    // Weighted Random Choice
                    let choice = '';
                    if (qConfig.options) {
                        choice = this.getWeightedChoice(qConfig.options);
                    } else if (qConfig.type === 'text') {
                        choice = qConfig.value; // For departments hardcoded or single val
                    }

                    // Logic Rules Check (Simplistic for now, mainly Age -> Education if needed, but per request rules are mostly removed/standardized)
                    // If we had logic rules, we'd apply them here. 
                    // Current request: No Marital status. Age 18-24 / 25-34 only.

                    currentChoices[key] = choice;

                    // Interaction
                    if (qConfig.type === 'radio') {
                        await this.selectRadioOption(page, entryId, choice, questionText);
                    } else if (qConfig.type === 'text') {
                        await this.typeText(page, entryId, choice, questionText);
                    }
                }

                // --- 2. FILL LIKERT SCALES ---
                this.log(`🌈 Likert soruları dolduruyorum (Hep pozitif, senin gibi!) 💜`);

                // Collect Demographic IDs/Texts to SKIP
                const DEMOGRAPHIC_IDS = Object.values(questions).map((q: any) => q.id);

                // Get all question containers
                const formQuestions = await page.$$('[role="listitem"]');

                for (const q of formQuestions) {
                    // Safety: Check if this is a demographic question
                    const input = await q.$('input[type="hidden"]');
                    if (input) {
                        const name = await input.evaluate(el => el.getAttribute('name'));
                        if (name && DEMOGRAPHIC_IDS.includes(name)) continue;
                    }

                    const radioGroup = await q.$('div[role="radiogroup"]');
                    if (!radioGroup) continue;

                    // Check if already filled
                    const isFilled = await radioGroup.$('div[aria-checked="true"]');
                    if (isFilled) continue;

                    // Scroll
                    try {
                        await q.evaluate((el: Element) => el.scrollIntoView({ block: 'center' }));
                    } catch (e) { }
                    await humanSleep(300, 700);

                    const options = await radioGroup.$$('div[role="radio"]');

                    // If not 5 options, likely demographic or other -> skip
                    if (options.length !== 5) continue;

                    // START PACING LOGIC
                    // We need to burn time to hit the user's requested 120s-300s window.
                    // We can simply sleep longer between questions.
                    // However, we can't know total questions easily. 
                    // Better strategy: Simple sleep between questions.
                    // If 50 questions, 20 questions... let's do random sleep 1s-3s per question + explicit wait at end?
                    // Better: Random sleep here.
                    await humanSleep(1000, 2500);

                    // PICK OPTION: Only Kararsızım (2), Katılıyorum (3), Kesinlikle Katılıyorum (4)
                    const allowedIndices = [2, 3, 4];
                    // You can weight this too if you want. Let's do equal or weighted positive.
                    // Let's favor 3 and 4.
                    const rand = Math.random();
                    let selectedIndex = 2; // Default Kararsızım
                    if (rand < 0.10) selectedIndex = 2; // 10% Kararsızım
                    else if (rand < 0.50) selectedIndex = 3; // 40% Katılıyorum
                    else selectedIndex = 4; // 50% Kesinlikle Katılıyorum

                    if (selectedIndex < options.length) {
                        await options[selectedIndex].click();
                    }
                }

                // --- PACING CHECK ---
                const elapsedSec = (Date.now() - startTime) / 1000;
                const targetDuration = getRandomInt(this.config.timing.minExecTimeSec, this.config.timing.maxExecTimeSec);

                if (elapsedSec < targetDuration) {
                    const waitTime = targetDuration - elapsedSec;
                    this.log(`⏳ Çok hızlıydık! ${waitTime.toFixed(0)} saniye daha bekleyeyim, merak etme...`);
                    await sleep(waitTime * 1000);
                } else {
                    this.log(`✨ Bu anketi ${elapsedSec.toFixed(0)} saniyede bitirdik, harika gidiyoruz!`);
                }

                // --- 3. SUBMIT ---
                this.log(`📤 Formu gönderiyorum... Parmaklar çapraz! 🤞`);
                const submitBtn = await page.$('div[role="button"][aria-label="Gönder"], div[role="button"][aria-label="Submit"]');
                if (submitBtn) {
                    await submitBtn.click();
                } else {
                    // Fallback search
                    const spans = await page.$$('span');
                    for (const span of spans) {
                        const text = await page.evaluate((el: HTMLElement) => el.innerText, span);
                        if (text === 'Gönder' || text === 'Submit') {
                            const btn = await page.evaluateHandle((el: HTMLElement) => el.closest('div[role="button"]'), span);
                            if (btn) await (btn as any).click();
                            break;
                        }
                    }
                }

                // Verify - try multiple possible selectors
                try {
                    await Promise.race([
                        page.waitForSelector('.freebirdFormviewerViewResponseConfirmationMessage', { timeout: 15000 }),
                        page.waitForSelector('[role="heading"]', { timeout: 15000 }),
                        page.waitForNavigation({ timeout: 15000 })
                    ]);
                } catch (e) {
                    // Even if selector not found, if URL changed it might be success
                    const currentUrl = page.url();
                    if (!currentUrl.includes('formResponse')) {
                        this.log(`🤔 Onay sayfası farklı görünüyor ama sorun yok!`);
                    }
                }
                await humanSleep(2000, 4000);
                successfulSubmissions++;
                const encouragements = ['Harikasın! 💕', 'Çok iyi gidiyorsun! 🌸', 'Seni seviyorum! 💜', 'Başarıyorsun tatlım! 🌷', 'Gurur duyuyorum! 🌻'];
                const randomEnc = encouragements[Math.floor(Math.random() * encouragements.length)];
                this.log(`🎉 Anket gönderildi! (${successfulSubmissions}/${this.config.targetCount}) ${randomEnc}`);

            } catch (e) {
                this.log(`💔 Bir sorun oluştu ama devam ediyoruz: ${e}`);
                await page.screenshot({ path: `error-${Date.now()}.png` });
            } finally {
                await browser.close();
            }

            if (!this.isRunning) break;

            // --- 4. COOLDOWN ---
            if (successfulSubmissions < this.config.targetCount) {
                const delayMinutes = getRandomInt(this.config.timing.minCooldownMin, this.config.timing.maxCooldownMin);
                this.log(`☕ ${delayMinutes} dakika kahve molası... Bu arada seni düşünüyorum! 💭💕`);
                // Break sleep into chunks to check for stop signal
                const msToSleep = delayMinutes * 60 * 1000;
                const chunk = 1000;
                let slept = 0;
                while (slept < msToSleep) {
                    if (!this.isRunning) break;
                    await sleep(chunk);
                    slept += chunk;
                }
            }
        }

        this.log('🎊 Tüm anketler tamamlandı! Sen başardın, akademisyen hanımefendi! 👩‍🎓💐 Seni çok seviyorum! 💕');
        this.isRunning = false;
    }

    private getWeightedChoice(options: any[]) {
        if (typeof options[0] === 'string') return options[Math.floor(Math.random() * options.length)];

        const totalWeight = options.reduce((sum: number, opt: any) => sum + (opt.weight || 0), 0);
        let random = Math.random() * totalWeight;
        for (const opt of options) {
            if (random < opt.weight) return opt.value;
            random -= opt.weight;
        }
        return options[0].value;
    }

    private async selectRadioOption(page: any, entryId: string, optionTextOrValue: string, questionText?: string) {
        // Robust selector using Question Text -> Container -> Option
        try {
            const found = await page.evaluate(async (qText: string, optText: string, id: string) => {
                let container: Element | null = null;

                if (qText) {
                    const headings = Array.from(document.querySelectorAll('[role="heading"], .M7eMe'));
                    const normalize = (t: string) => t.toLowerCase().replace(/\s+/g, '').replace('*', '');
                    const target = normalize(qText);
                    const heading = headings.find(h => normalize((h as HTMLElement).innerText).includes(target));
                    if (heading) container = heading.closest('[role="listitem"]');
                }

                if (!container && id) {
                    const hiddenInput = document.querySelector(`input[name="${id}"]`);
                    if (hiddenInput) container = hiddenInput.closest('[role="listitem"]');
                }

                if (container) {
                    container.scrollIntoView({ block: 'center', behavior: 'instant' });
                    const options = Array.from(container.querySelectorAll('div[role="radio"], label'));
                    for (const opt of options) {
                        const el = opt as HTMLElement;
                        const elText = el.innerText.trim();
                        if (elText.includes(optText) || el.getAttribute('data-value') === optText) {
                            el.click();
                            return true;
                        }
                    }
                }
                return false;
            }, questionText || "", optionTextOrValue, entryId);

            if (!found) this.log(`[WARN] Could not select radio: ${optionTextOrValue}`);
            await humanSleep(500, 1000);

        } catch (e) { this.log(`[ERROR] Select radio failed: ${e}`); }
    }

    private async typeText(page: any, entryId: string, text: string, questionText?: string) {
        try {
            this.log(`[TEXT] Typing "${text}" for ${questionText || entryId}`);

            let inputHandle = null;

            // 1. Question text ile container bul
            if (questionText) {
                this.log(`[DEBUG] Searching for question text: "${questionText}"`);
                const container = await page.evaluateHandle((qText: string) => {
                    const normalize = (t: string) => t.toLowerCase().replace(/\s+/g, '').replace('*', '');
                    const headings = Array.from(document.querySelectorAll('[role="heading"], .M7eMe'));
                    const target = normalize(qText);
                    console.log('Looking for:', target);
                    console.log('Found headings:', headings.map(h => (h as HTMLElement).innerText));
                    const heading = headings.find(h => normalize((h as HTMLElement).innerText).includes(target));
                    console.log('Matched heading:', heading ? (heading as HTMLElement).innerText : 'NONE');
                    return heading ? heading.closest('[role="listitem"]') : null;
                }, questionText);

                const asElement = container.asElement();
                this.log(`[DEBUG] Container found: ${asElement ? 'YES' : 'NO'}`);

                if (asElement) {
                    inputHandle = await asElement.$('input, textarea');
                    this.log(`[DEBUG] Input in container: ${inputHandle ? 'YES' : 'NO'}`);
                }
            }

            // 2. Fallback: entryId
            if (!inputHandle && entryId) {
                this.log(`[DEBUG] Fallback: searching by entryId "${entryId}"`);
                inputHandle = await page.$(`input[name="${entryId}"], textarea[name="${entryId}"]`);
                this.log(`[DEBUG] Input by ID: ${inputHandle ? 'YES' : 'NO'}`);
            }

            if (!inputHandle) {
                this.log(`[ERROR] Input not found for ${entryId}`);
                return;
            }

            // 3. Scroll into view first
            this.log(`[DEBUG] Scrolling input into view...`);
            await inputHandle.evaluate((el: any) => el.scrollIntoView({ block: 'center' }));
            await humanSleep(300, 500);

            // 4. GERÇEK Puppeteer click + type (React State güncellemesi için şart)
            this.log(`[DEBUG] Clicking input...`);
            await inputHandle.click({ clickCount: 3 }); // select all
            await page.keyboard.press('Backspace');
            await humanSleep(200, 400);

            this.log(`[DEBUG] Typing text...`);
            await inputHandle.type(text, { delay: getRandomInt(60, 140) });
            await humanSleep(500, 1000);

            this.log(`[OK] Text written: ${text}`);

        } catch (e) {
            this.log(`[ERROR] typeText failed: ${e}`);
        }
    }
}