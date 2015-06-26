module.exports = {
  database: {
    module: './database/elasticsearch.js',
    dev_host: '141.89.225.46',//'192.168.42.54', // devip 141.89.225.46
    dep_host: '192.168.42.54',
    port: 9200
  },
  /* The port that the application web server will listen on
   * If this is changed to something different from the default, you will need to append port numbers
   * to the OAuth callbacks from the various social media sources  */
  port: 80,
  /* The address you will reach the root of the application on
   * If you serve it over https, change it accordingly here!
   */

  url: 'http://localhost',
  company: 'sap',

  metaIndex: '_meta',
  postIndex: '_post_{Y}{W}', // year will replace Y, weeknumber will replace W
  crawlerIndex: '_crawler',
  postIndexVersionNumber: 2,
  maxCrawlDelay: 28,
  mailgun: {
    api: 'https://api.mailgun.net/v3/n2o.social/messages',
    api_token: 'YXBpOmtleS0wMTkxODI0NmU1OWNkYTIzNzVkM2E3MDc2YmQzZTgxOQ=='
  },
  xing: {
    //consumer_key: 'aeafbb16c6ae57838df8',
    //application_secret: 'ea6eb4b2f569b5b081320f6d98ddb016aec76f79',
    consumer_key: '62c1130de744ab349845',
    application_secret: '8a069cf9eaa5d5be2db30936ec47cdd072cb63bc'
  },
  rejectCountForNewsfeed: 3,
  quoraKeywords: ['Talent Management Software', 'Recruiting Software', 'Human Resource Management Systems', 'customer relation management', 'CRM'],
  numberOfShards: 5,
  products: ['CRM', 'ECOM', 'LVM', 'HCM'],
  /* This directory is either relative to the crawler files
   * e.g. inside the xing/linkedin/quora directory: ../logs
   * It can also be given absolutely of course: /home/crawler/logs
   */
  crawlerLogDirectory: '../logs'
}

// for HANA database replace with:
/*
    module: './database/hana.js',
    user: 'SYSTEM',
    password: 'Popcorn57',
    host: '192.168.42.38',
    port: 30615
*/

// for elasticsearch replace with:
/*
  module: './database/elasticsearch.js',
  host: '192.168.42.54',
  port: 9200

*/
