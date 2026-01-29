import { describe, it, expect } from 'vitest';
import { renderTemplate, extractTemplateVariables, formatEmailAddress, calculateBackoff } from '../utils';

describe('Utils', () => {
  describe('renderTemplate', () => {
    it('should replace variables in template', () => {
      const template = 'Hello {{name}}!';
      const result = renderTemplate(template, { name: 'World' });
      expect(result).toBe('Hello World!');
    });

    it('should handle multiple variables', () => {
      const template = 'Hello {{firstName}} {{lastName}}!';
      const result = renderTemplate(template, { firstName: 'John', lastName: 'Doe' });
      expect(result).toBe('Hello John Doe!');
    });

    it('should keep missing variables as-is', () => {
      const template = 'Hello {{name}}! {{missing}}';
      const result = renderTemplate(template, { name: 'World' });
      expect(result).toBe('Hello World! {{missing}}');
    });
  });

  describe('extractTemplateVariables', () => {
    it('should extract variables from template', () => {
      const template = 'Hello {{name}}! Welcome to {{company}}.';
      const result = extractTemplateVariables(template);
      expect(result).toEqual(['name', 'company']);
    });

    it('should remove duplicates', () => {
      const template = '{{name}} {{name}}';
      const result = extractTemplateVariables(template);
      expect(result).toEqual(['name']);
    });

    it('should return empty array for no variables', () => {
      const template = 'Hello World!';
      const result = extractTemplateVariables(template);
      expect(result).toEqual([]);
    });
  });

  describe('formatEmailAddress', () => {
    it('should format email with name', () => {
      const result = formatEmailAddress('test@example.com', 'Test User');
      expect(result).toBe('"Test User" <test@example.com>');
    });

    it('should return email only without name', () => {
      const result = formatEmailAddress('test@example.com');
      expect(result).toBe('test@example.com');
    });
  });

  describe('calculateBackoff', () => {
    it('should increase delay exponentially', () => {
      const delay0 = calculateBackoff(0, 1000);
      const delay1 = calculateBackoff(1, 1000);
      const delay2 = calculateBackoff(2, 1000);

      expect(delay0).toBeGreaterThanOrEqual(1000);
      expect(delay1).toBeGreaterThanOrEqual(2000);
      expect(delay2).toBeGreaterThanOrEqual(4000);
    });

    it('should respect max delay', () => {
      const delay = calculateBackoff(100, 1000, 5000);
      expect(delay).toBeLessThanOrEqual(5000);
    });
  });
});
