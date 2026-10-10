#!/usr/bin/env node
'use strict';

const { spawnSync } = require('child_process');
const path = require('path');
const { mutations } = require('./video-test.js');
const root = path.resolve(__dirname, '..');
const names = process.argv[2] ? [process.argv[2]] : Object.keys(mutations);
for (const name of names) if (!mutations[name]) throw Error('Unknown video mutation: ' + name);
let missed = 0;
for (const name of names) {
  const group = mutations[name].group;
  const result = spawnSync(process.execPath, [path.join(__dirname, 'video-test.js'), root, name, group], { encoding: 'utf8', timeout: 30000, env: process.env });
  // A crashed process or missing anchor is not a successful mutation test.
  const caught = result.status === 1 && result.stdout.split('\n').some(line => line.startsWith('FAIL ' + group + ':'));
  console.log((caught ? 'CAUGHT ' : 'MISSED ') + name + ' → ' + group);
  if (!caught) { missed++; console.log(result.stdout, result.stderr); if (result.error) console.log(result.error.message); }
}
console.log(`${names.length - missed}/${names.length} video mutations caught`);
process.exitCode = missed ? 1 : 0;
