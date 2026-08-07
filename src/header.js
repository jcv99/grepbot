// ==UserScript==
// @name         GrepBot
// @namespace    grepbot
// @version      1.5.20
// @description  Grepolis scout/farm/build/trade/culture/recruit automation. ToS forbid automation; risk = ban.
// @author       j
// @match        https://*.grepolis.com/*
// @run-at       document-idle
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @connect      grepolis.com
// @connect      discord.com
// @connect      discordapp.com
// @connect      api.telegram.org
// ==/UserScript==

(function () {
  'use strict';
