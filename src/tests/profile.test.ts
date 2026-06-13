/**
 * Tests for profile.ts pure helpers: isProfileComplete and completionPercent.
 *
 * Covers the AUTH-05 gate logic: an agent must have display_name, phone,
 * brokerage, and license_number (four-field gate) to unlock the dashboard.
 * photo_url contributes to the five-field progress bar (20% each) but does
 * not block the dashboard gate.
 *
 * @module tests/profile
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isProfileComplete,
  completionPercent,
} from '../lib/profile.ts';

/** Minimal agent shape used for testing */
interface AgentProfile {
  display_name?: string | null;
  photo_url?: string | null;
  phone?: string | null;
  brokerage?: string | null;
  license_number?: string | null;
}

describe('isProfileComplete', () => {
  it('returns true when all four required fields are provided', () => {
    const agent: AgentProfile = {
      display_name: 'Alice Smith',
      phone: '713-555-0100',
      brokerage: 'Houston Realty',
      license_number: 'TX-12345',
    };
    assert.equal(isProfileComplete(agent), true);
  });

  it('returns true when photo_url is also provided (five fields)', () => {
    const agent: AgentProfile = {
      display_name: 'Alice Smith',
      photo_url: 'https://example.com/photo.jpg',
      phone: '713-555-0100',
      brokerage: 'Houston Realty',
      license_number: 'TX-12345',
    };
    assert.equal(isProfileComplete(agent), true);
  });

  it('returns false when phone is null', () => {
    const agent: AgentProfile = {
      display_name: 'Alice Smith',
      phone: null,
      brokerage: 'Houston Realty',
      license_number: 'TX-12345',
    };
    assert.equal(isProfileComplete(agent), false);
  });

  it('returns false when phone is undefined', () => {
    const agent: AgentProfile = {
      display_name: 'Alice Smith',
      brokerage: 'Houston Realty',
      license_number: 'TX-12345',
    };
    assert.equal(isProfileComplete(agent), false);
  });

  it('returns false when display_name is empty string', () => {
    const agent: AgentProfile = {
      display_name: '',
      phone: '713-555-0100',
      brokerage: 'Houston Realty',
      license_number: 'TX-12345',
    };
    assert.equal(isProfileComplete(agent), false);
  });

  it('returns false when brokerage is empty string', () => {
    const agent: AgentProfile = {
      display_name: 'Alice Smith',
      phone: '713-555-0100',
      brokerage: '',
      license_number: 'TX-12345',
    };
    assert.equal(isProfileComplete(agent), false);
  });

  it('returns false when license_number is null', () => {
    const agent: AgentProfile = {
      display_name: 'Alice Smith',
      phone: '713-555-0100',
      brokerage: 'Houston Realty',
      license_number: null,
    };
    assert.equal(isProfileComplete(agent), false);
  });

  it('returns false when display_name is null (even if photo_url present)', () => {
    const agent: AgentProfile = {
      display_name: null,
      photo_url: 'https://example.com/photo.jpg',
      phone: '713-555-0100',
      brokerage: 'Houston Realty',
      license_number: 'TX-12345',
    };
    assert.equal(isProfileComplete(agent), false);
  });

  it('returns false for an empty object', () => {
    assert.equal(isProfileComplete({}), false);
  });
});

describe('completionPercent', () => {
  it('returns 100 when all five fields are filled', () => {
    const agent: AgentProfile = {
      display_name: 'Alice Smith',
      photo_url: 'https://example.com/photo.jpg',
      phone: '713-555-0100',
      brokerage: 'Houston Realty',
      license_number: 'TX-12345',
    };
    assert.equal(completionPercent(agent), 100);
  });

  it('returns 0 when no fields are filled', () => {
    assert.equal(completionPercent({}), 0);
  });

  it('returns 60 when three of five fields filled (name, phone, brokerage; photo_url + license empty)', () => {
    const agent: AgentProfile = {
      display_name: 'Alice Smith',
      photo_url: '',
      phone: '713-555-0100',
      brokerage: 'Houston Realty',
      license_number: '',
    };
    assert.equal(completionPercent(agent), 60);
  });

  it('returns 20 when only display_name is filled', () => {
    const agent: AgentProfile = {
      display_name: 'Alice Smith',
      photo_url: null,
      phone: null,
      brokerage: null,
      license_number: null,
    };
    assert.equal(completionPercent(agent), 20);
  });

  it('returns 40 when two fields filled (display_name + photo_url)', () => {
    const agent: AgentProfile = {
      display_name: 'Alice Smith',
      photo_url: 'https://example.com/photo.jpg',
      phone: null,
      brokerage: null,
      license_number: null,
    };
    assert.equal(completionPercent(agent), 40);
  });

  it('returns 80 when four fields filled (all except photo_url)', () => {
    const agent: AgentProfile = {
      display_name: 'Alice Smith',
      photo_url: null,
      phone: '713-555-0100',
      brokerage: 'Houston Realty',
      license_number: 'TX-12345',
    };
    assert.equal(completionPercent(agent), 80);
  });

  it('treats empty string as incomplete (returns 0 for all-empty-strings)', () => {
    const agent: AgentProfile = {
      display_name: '',
      photo_url: '',
      phone: '',
      brokerage: '',
      license_number: '',
    };
    assert.equal(completionPercent(agent), 0);
  });
});
