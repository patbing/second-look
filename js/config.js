/* Second Look configuration. Classic script. */
(function () {
  'use strict';
  window.SL = window.SL || {};
  window.SL.config = {
    // Public App Key (pk_...) registered for this page's address. Safe to commit.
    APP_KEY: 'pk_Pf15b9XrDeHp9n5E',
    REPO_URL: 'https://github.com/patbing/second-look',
    API: 'https://gen.pollinations.ai',
    TIMEOUT_MS: 90000,
    // Free (paid_only: false) defaults from different families, checked against the live model list when the page loads.
    DESCRIBE: 'z-ai/glm-5.3-flash',
    CHECK: 'openai/gpt-6-luna',
    DESCRIBE_MAX: 3000, // reasoning models spend output tokens thinking; too few and the reply is empty
    CHECK_MAX: 600,
    SIDE: 1024, // the photo is resized to this longest side before it is sent
    CROP_MIN: 512,
    // Pollen this page may spend per visit, from listed prices. A photo that could pass it is not sent.
    CAP: 0.05
  };
})();
