'use strict'

/**
 *  Baz protocol compiler.
 */

const fs = require('fs')
const {
  extname,
  basename,
  join
} = require('path')

const utils = require('./utils')
const templates = require('./templates')

const argv = process.argv
const MAX_NARG = 32

class ProtocolCompiler {
  constructor (filename) {
    this.filename = filename
    this.msg = fs.readFileSync(this.filename).toString('utf-8')
    this.tokens = null
    this.tkp = /^([A-Za-z0-9_]+|;|,|\(|\)|{|}|->)$/
    this.src = null
    this.pos = 0

    this.srvAst = []
    this.srvCtx = new Set()
    this.msgAst = []
    this.msgCtx = new Set()

    this.TKTYPE = Object.freeze({
      KEYWORD: 0,
      IDENT: 1,
      SEMICOLON: 2,
      COMMA: 3,
      LPAREN: 4,
      RPAREN: 5,
      LBRACE: 6,
      RBRACE: 7,
      ARROW: 8,
      VALTYPE: 9,
      EOF: 10
    })

    this.tkTypeKeys = Object.keys(this.TKTYPE)

    this.RAW2TK = Object.freeze({
      'srv': { type: this.TKTYPE.KEYWORD, value: 'srv' },
      'msg': { type: this.TKTYPE.KEYWORD, value: 'msg' },
      'proc': { type: this.TKTYPE.KEYWORD, value: 'proc' },
      ';': { type: this.TKTYPE.SEMICOLON, value: ';' },
      ',': { type: this.TKTYPE.COMMA, value: ',' },
      '(': { type: this.TKTYPE.LPAREN, value: '(' },
      ')': { type: this.TKTYPE.RPAREN, value: ')' },
      '{': { type: this.TKTYPE.LBRACE, value: '{' },
      '}': { type: this.TKTYPE.RBRACE, value: '}' },
      '->': { type: this.TKTYPE.ARROW, value: '->' }
    })
  }

  _splitCompoundTokens (raws, tks) {
    let ret = raws

    ;[...tks].forEach(tk => {
      ret = ret
        .map(str =>
          str === tk
            ? str
            : str.split(tk).map(s => s || tk))
        .reduce((a, v) => a.concat(v), [])
    })

    return ret
  }

  tokenize () {
    const raws = this._splitCompoundTokens(
      this.msg
        .split(/\r?\n/)
        .map(line => line.split(' ').filter(utils.Id))
        .reduce((a, v) => a.concat(v), []),
      '(){};,' /* Paired characters should be placed ahead */
    )

    this.tokens = raws.map(raw => {
      utils.expects(
        this.tkp.test(raw), `invalid characters found in \`${raw}'`
      )

      const tk = this.RAW2TK[raw]

      if (tk) {
        return tk
      }

      if (/^(string|number|object|array|boolean|unit)$/.test(raw)) {
        return { type: this.TKTYPE.VALTYPE, value: raw }
      }

      return { type: this.TKTYPE.IDENT, value: raw }
    })

    this.tokens.push({ type: this.TKTYPE.EOF, value: null })
    return this
  }

  get cur () {
    return this.tokens[this.pos]
  }

  _advance () {
    ++this.pos
  }

  _match (expected) {
    let matched

    if (typeof expected === 'number') {
      matched = this.cur.type === expected
    } else if (typeof expected === 'string') {
      matched = this.cur.value === expected
    } else {
      throw new Error(`invalid value to match: ${expected}`)
    }

    return [matched, this.cur]
  }

  _reprToken (v) {
    switch (typeof v) {
      case 'number':
        return this.tkTypeKeys[v]
      case 'object':
        return v.value
      default:
        return v
    }
  }

  _matchErr (tk, expected) {
    let repr

    if (expected instanceof Array) {
      repr = expected.map(v => this._reprToken(v)).join('\' or `')
    } else {
      repr = this._reprToken(expected)
    }

    utils.expects(
      false,
      `parse error with \`${tk.value}', expecting \`${repr}'`
    )
  }

  _eat (expected) {
    const [ok, tk] = this._match(expected)
    if (!ok) this._matchErr(tk, expected)
    this._advance()
    return tk
  }

  _oneOf (tks) {
    let ok, tk

    for (const expected of tks) {
      ;[ok, tk] = this._match(expected)
      if (ok) break
    }

    if (!ok) this._matchErr(tk, tks)
    this._advance()
    return tk
  }

  _eatSome (tks) {
    let tk

    if (tks.length === 0) {
      throw new Error('one or more tokens should be eaten')
    }

    tks.forEach(expected => {
      tk = this._eat(expected)
    })

    return tk
  }

  * _getMsgFields () {
    const ctx = new Set()

    while (true) {
      const obj = {
        name: null,
        type: null
      }

      if (this.cur.type === this.TKTYPE.RBRACE) {
        return
      }

      obj.name = this._eat(this.TKTYPE.IDENT).value
      obj.type = this._eat(this.TKTYPE.VALTYPE).value
      this._eat(this.TKTYPE.SEMICOLON)

      utils.expects(
        !ctx.has(obj.name),
        `message field \`${obj.name}' already defined`
      )
      ctx.add(obj.name)

      yield obj
    }
  }

  * _getProc () {
    const ctx = new Set()

    while (true) {
      let i = 0
      let tk = null

      const obj = {
        name: null,
        args: [],
        ret: null
      }

      if (this.cur.type === this.TKTYPE.RBRACE) {
        return
      }

      this._eat('proc')
      obj.name = this._eat(this.TKTYPE.IDENT).value
      this._eat(this.TKTYPE.LPAREN)

      for (i = 0; i < MAX_NARG; ++i) {
        tk = this._eat(this.TKTYPE.IDENT)

        obj.args.push(tk.value)
        tk = this._oneOf([this.TKTYPE.COMMA, this.TKTYPE.RPAREN])

        if (tk.type === this.TKTYPE.RPAREN) {
          break
        }
      }

      utils.expects(i !== MAX_NARG,
        `parse error: too many args in proc \`${obj.name}'`)

      tk = this._eatSome([this.TKTYPE.ARROW, this.TKTYPE.IDENT])
      obj.ret = tk.value
      this._eat(this.TKTYPE.SEMICOLON)

      utils.expects(
        !ctx.has(obj.name),
        `process \`${obj.name}' already defined`
      )
      ctx.add(obj.name)

      yield obj
    }
  }

  * _getMessageOrService () {
    while (true) {
      if (this.cur.type === this.TKTYPE.EOF) {
        return
      }

      const obj = {
        type: null,
        name: null,
        fields: []
      }

      obj.type = this._oneOf(['srv', 'msg']).value
      obj.name = this._eat(this.TKTYPE.IDENT).value
      this._eat(this.TKTYPE.LBRACE)

      for (
        const field of
        obj.type === 'srv'
          ? this._getProc()
          : this._getMsgFields()
      ) {
        obj.fields.push(field)
      }

      this._eat(this.TKTYPE.RBRACE)
      yield obj
    }
  }

  parse () {
    for (const item of this._getMessageOrService()) {
      const [
        itemCtx,
        itemAst
      ] = item.type === 'srv'
        ? [this.srvCtx, this.srvAst]
        : [this.msgCtx, this.msgAst]

      utils.expects(
        !itemCtx.has(item.name),
        `item \`${item.type} ${item.name}' already declared`
      )

      itemCtx.add(item.name)
      itemAst.push(item)
    }

    return this
  }

  analyze () {
    const valid = this.srvAst.every(srv =>
      srv.fields.every(proc =>
        proc.args.every(arg =>
          this.msgCtx.has(arg))))
    utils.expects(valid, 'semantic error: undeclared messages found')
    return this
  }

  generate () {
    return this
  }

  writeTo (dir) {
    const fname = this.filename
    const bname = basename(fname, extname(fname))
    const components = ['server', 'client', 'proto', 'service']
    const files = components.map(item => join(dir, `${bname}.${item}.js`))

    templates.forEach((tmpl, i) => {
      fs.writeFileSync(files[i], tmpl.replace('FIXME', bname))
    })
    return this
  }
}

if (argv.length !== 3) {
  utils.expects(false, `Usage: ${argv[1]} FILENAME`)
}

const compiler = new ProtocolCompiler(argv[2])

compiler
  .tokenize()
  .parse()
  .analyze()
  .generate()
  .writeTo('.')
