import type { RegionId } from "../types";

/**
 * Where to find a human when it matters.
 *
 * Every number and address here was checked against the organisation's own
 * site or an official health-service listing on the date below. Services
 * change: re-verify this file at least every six months and before any launch
 * in a new country. Opening hours are deliberately not repeated here.
 */
export const SUPPORT_LAST_CHECKED = "2026-11-10";

export interface Contact {
  name: string;
  /** What to do, in a few words: "Call 116 123". */
  action: string;
  detail?: string;
  /** tel:, sms: or https: link. */
  href?: string;
}

export interface RegionSupport {
  emergency: { number: string; note?: string };
  crisis: Contact[];
  stammering: Contact[];
}

const FIND_A_HELPLINE: Contact = {
  name: "Find a Helpline",
  action: "findahelpline.com",
  detail: "A directory of free, confidential crisis lines around the world.",
  href: "https://findahelpline.com",
};

const ISA: Contact = {
  name: "International Stuttering Association",
  action: "isastutter.org",
  detail: "National associations and self-help groups around the world.",
  href: "https://www.isastutter.org",
};

const WSN: Contact = {
  name: "World Stuttering Network",
  action: "worldstutteringnetwork.org",
  detail: "An international network connecting people who stutter.",
  href: "https://www.worldstutteringnetwork.org",
};

export const SUPPORT: Record<RegionId, RegionSupport> = {
  uk: {
    emergency: { number: "999" },
    crisis: [
      { name: "Samaritans", action: "Call 116 123", detail: "Free, any time, day or night.", href: "tel:116123" },
      { name: "Shout", action: "Text SHOUT to 85258", detail: "Free text support, any time.", href: "sms:85258?&body=SHOUT" },
      { name: "NHS 111", action: "Call 111", detail: "Urgent mental health help in England, Scotland and Wales.", href: "tel:111" },
    ],
    stammering: [
      {
        name: "STAMMA",
        action: "Helpline 0808 802 0002",
        detail: "Free helpline, webchat and email from the British Stammering Association. Opening times are on stamma.org.",
        href: "https://stamma.org/get-support/talk-to-us",
      },
    ],
  },
  ie: {
    emergency: { number: "112 or 999" },
    crisis: [
      { name: "Samaritans", action: "Call 116 123", detail: "Freephone, any time, day or night.", href: "tel:116123" },
      { name: "Text About It", action: "Text HELLO to 50808", detail: "Free text support, any time.", href: "sms:50808?&body=HELLO" },
    ],
    stammering: [
      {
        name: "Irish Stammering Association",
        action: "stammeringireland.ie",
        detail: "Support groups and information for people who stammer in Ireland.",
        href: "https://www.stammeringireland.ie",
      },
    ],
  },
  us: {
    emergency: { number: "911" },
    crisis: [
      { name: "988 Suicide & Crisis Lifeline", action: "Call or text 988", detail: "Free, any time, day or night.", href: "tel:988" },
    ],
    stammering: [
      {
        name: "National Stuttering Association",
        action: "westutter.org",
        detail: "Local chapters and online support groups for adults who stutter.",
        href: "https://westutter.org",
      },
      {
        name: "The Stuttering Foundation",
        action: "stutteringhelp.org",
        detail: "Free resources and a referral list of specialist clinicians.",
        href: "https://www.stutteringhelp.org",
      },
    ],
  },
  ca: {
    emergency: { number: "911" },
    crisis: [
      { name: "9-8-8 Suicide Crisis Helpline", action: "Call or text 9-8-8", detail: "Free, any time, in English and French.", href: "tel:988" },
    ],
    stammering: [
      {
        name: "Canadian Stuttering Association",
        action: "stutter.ca",
        detail: "Support groups, events and information across Canada.",
        href: "https://stutter.ca",
      },
    ],
  },
  au: {
    emergency: { number: "000" },
    crisis: [
      { name: "Lifeline", action: "Call 13 11 14", detail: "Crisis support, any time. You can also text 0477 13 11 14.", href: "tel:131114" },
    ],
    stammering: [
      {
        name: "Australian Stuttering Research Centre",
        action: "Community support groups",
        detail: "A list of support groups for adults who stutter, and a free online programme for speaking-related anxiety.",
        href: "https://www.uts.edu.au/research/centres/australian-stuttering-research-centre/community-support-groups",
      },
    ],
  },
  nz: {
    emergency: { number: "111" },
    crisis: [
      { name: "1737 — Need to talk?", action: "Call or text 1737", detail: "Free, any time, to talk with a trained counsellor.", href: "tel:1737" },
    ],
    stammering: [ISA],
  },
  za: {
    emergency: { number: "112", note: "From a mobile phone. You can also call 10111 for police or 10177 for an ambulance." },
    crisis: [
      {
        name: "SADAG Suicide Crisis Helpline",
        action: "Call 0800 567 567",
        detail: "Toll-free, any time, from the South African Depression and Anxiety Group.",
        href: "tel:0800567567",
      },
    ],
    stammering: [ISA],
  },
  in: {
    emergency: { number: "112" },
    crisis: [
      { name: "Tele-MANAS", action: "Call 14416", detail: "Free government mental health helpline, any time, in many languages.", href: "tel:14416" },
    ],
    stammering: [
      {
        name: "The Indian Stammering Association",
        action: "stammer.in",
        detail: "Free self-help groups run by people who stammer, in many cities.",
        href: "https://www.stammer.in",
      },
    ],
  },
  other: {
    emergency: { number: "your local emergency number", note: "112 works in many countries." },
    crisis: [FIND_A_HELPLINE],
    stammering: [ISA, WSN],
  },
};

/** Shown under every region's own list. */
export const WORLDWIDE: Contact[] = [FIND_A_HELPLINE, ISA, WSN];

export function supportFor(region: RegionId): RegionSupport {
  return SUPPORT[region] ?? SUPPORT.other;
}
