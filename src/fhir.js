const path = require('path');
const fetch = require('node-fetch');
const debug = require('debug')('vsac'); // To turn on DEBUG: $ export DEBUG=vsac
const { Code, ValueSet } = require('cql-execution');

async function downloadValueSet(
  apiKey,
  oid,
  version,
  output,
  vsacUrl,
  vsDB = {},
  options = {
    /* reserved for future use */
  },
) {
  const pages = await getValueSetPages(apiKey, oid, version, vsacUrl);
  if (pages == null || pages.length === 0) {
    return;
  }

  const id = pages[0].id;
  version = pages[0].version;
  const codes = [];
  pages.forEach(page => {
    if (page.expansion && page.expansion.contains) {
      codes.push(...page.expansion.contains.map(c => new Code(c.code, c.system, c.version)));
    }
  });
  vsDB[id] = {};
  vsDB[id][version] = new ValueSet(id, version, codes);

}

async function getValueSetPages(apiKey, oid, version, vsacUrl, offset = 0, ) {
  const page = await getValueSet(apiKey, oid, version, vsacUrl ,offset);
  if (page && page.expansion) {
    const pTotal = page.expansion.total;
    const pOffset = page.expansion.offset;
    const pLength = page.expansion.contains && page.expansion.contains.length;
    if (pTotal != null && pOffset != null && pLength != null && pTotal > pOffset + pLength) {
      // Fetch and append the remaining value set pages
      const remainingPages = await getValueSetPages(apiKey, oid, version, vsacUrl, offset + pLength);
      return [page, ...remainingPages];
    } else {
      return [page];
    }
  }
}

async function getValueSet(apiKey, oid, version, vsacUrl, offset = 0) {
  debug(
    `Getting ValueSet: ${oid}${version != null ? ` version ${version}` : ''} (offset: ${offset})`
  );
  // const options = {
  //   headers: {
  //     Authorization: `Basic ${Buffer.from(`apikey:${apiKey}`).toString('base64')}`
  //   }
  // };
  // const params = new URLSearchParams({ offset });
  // if (version != null) {
  //   params.set('valueSetVersion', version);
  // }
  // const url = `https://cts.nlm.nih.gov/fhir/ValueSet/${oid}/$expand?${params}`;

  const options = {
    headers: {
      Authorization: `Basic ${btoa(`apikey:${apiKey}`)}`
    }
  };
  const params = new URLSearchParams({ offset });

  if (version != null) {
    params.set('valueSetVersion', version);
  }

  const url = `${vsacUrl.replace('{{oid}}', oid)}?${params}`;
  debug(`Built Url ${url}`);

  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(response.status);
  }
  return response.json();
}

module.exports = { name: 'FHIR', downloadValueSet };
