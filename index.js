const fetch = require('cross-fetch');

class CMSClient {
  /**
  * Create a client
  * @param {string} resourceId - Dataset resource id
  * @param {object} options - Fetch options
  */
  constructor(resourceId, options) {
    this.resourceId = resourceId;
    this.isOutdated = false;
    this.lastModified = '';
    this.type = options?.output || 'json';
    this.url = `https://data.cms.gov/resource/${this.resourceId}.${this.type}`;
    this.fetchOptions = {
      ...options,
      columns: '',
      filter: '',
      limit: 0,
      resource: '',
    };
    this.fetched = {
      metadata: {},
      fields: [],
      data: {} || '',
    };
  }

  /**
  * Select columns
  * @param {string} columns - Selected column(s), similar to `SELECT` in SQL
  */
  select(columns) {
    if (typeof columns === 'string') {
      this.fetchOptions.columns = columns;
      return this;
    }
    if (Array.isArray(columns)) {
      this.fetchOptions.columns = columns.join();
      return this;
    }
    return this;
  }

  /**
  * Filter by a record, similar to `WHERE` in SQL
  * @param {string} column - Target column
  * @param {string} resource - Target resource
  */
  filter(column, resource) {
    if (!resource || !column) throw new Error('Missing params: include column & resource to be filtered');
    this.fetchOptions = {
      column,
      resource,
    };
    return this;
  }

  /**
  * Limit the amount of records to return
  * @param {number} number - Number of records to return, similar to `LIMIT` in SQL
  */
  limit(limitResource) {
    if (limitResource) {
      this.fetchOptions.limit = limitResource;
    }
    return this;
  }

  _queryBuilder() {
    this.url = this.url.concat('?');

    // order of paramters does not matter here
    if (this.fetchOptions.limit > 0) {
      this.url = this.url.concat(`$limit=${this.fetchOptions.limit}`);
    }

    if (this.fetchOptions.filter !== '' && this.fetchOptions.resource !== '') {
      this.url = this.url.concat(`&${this.fetchOptions.column}=${this.fetchOptions.resource}`);
    }

    if (this.fetchOptions.columns !== '') {
      if (this.url[this.url.length - 1] === '?') {
        this.url = this.url.concat(`$select=${this.fetchOptions.columns}`);
      } else {
        this.url = this.url.concat(`&$select=${this.fetchOptions.columns}`);
      }
    }
  }

  async _fetchResource() {
    try {
      const resourceData = await fetch(this.url);
      const headers = await resourceData.headers;

      this.fetched.fields = JSON.parse(headers.get('x-soda2-fields').split(','));
      this.isOutdated = headers.get('x-soda2-data-out-of-date');
      this.lastModified = headers.get('Last-Modified');

      if (this.fetchOptions.includeMetadata) {
        await this._fetchResourceMetadata();
      }

      switch (this.type) {
        case 'csv':
          this.fetched.data = await resourceData.text();
          return;
        default:
          this.fetched.data = await resourceData.json();
          return;
      }
    } catch (error) {
      throw new Error(error);
    }
  }

  async _fetchResourceMetadata() {
    try {
      const metadataUrl = `https://data.cms.gov/api/views/metadata/v1/${this.resourceId}`;
      const metadata = await fetch(metadataUrl);
      this.fetched.metadata = await metadata.json();
    } catch (error) {
      throw new Error(error);
    }
  }

  /**
  * Get dataset from specified resource
  *
  * @async
  * @function get
  * @return {Promise<object>} Resolves to an object containing: data, fields, metadata
  */
  async get() {
    this._queryBuilder();
    await this._fetchResource();

    if (!this.fetched) {
      throw new Error('Data not fetched');
    }

    if (!this.isOutdated) {
      // eslint-disable-next-line no-console
      console.warn('Data is outdated');
    }
    return this.fetched;
  }
}
/**
*
* @function createClient
* @return {Class} New client instance
*/
function createClient(resourceId, options) {
  if (!resourceId || typeof resourceId !== 'string') throw Error(`Invalid argument: ${resourceId}`);
  return new CMSClient(resourceId, options);
}

module.exports = {
  createClient,
};
