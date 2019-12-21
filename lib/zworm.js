/**
 * 对象和数据表之间的自动映射
 * 数据库操作封装,提取常用的方法
 * @class ZWORM
 */
const ZWQuery = require('./zwormquery');

class ZWORM
{
    constructor( dbinst,tablename = null , saveop = null )
    {

        this._cls = Object.getPrototypeOf(this).constructor;

        this._dbinst = dbinst;

        this._saveop = saveop;
        if( saveop == null )
            this._saveop = { 'j':true,'w':1 };

        //如果不指定表名字,就是 t_ + 类名
        this._tableName = tablename;
        if( tablename == null )
            this._tableName = this._makeTableName();


        //查询返回的数据字段
        this._selectfields = {};
        
        //查询条件
        this._query = {};

        //排序规则
        this._sortby = [{'createat':-1}];
    }
    _makeTableName()
    {
        return ('t_' + obj.constructor.name).toLowerCase();
    }

    /**
     * id 默认 映射到 _id
     * 
     * 可以继承修改行为
     * 将属性名映射到数据库的字段名字,默认和属性名称相同
     * @param {string} propname
     * @returns {string} field
     * @memberof ZWORM
     */
    propMapField( propname )
    {
        /*比如对象里面定义的字段名字有自己的规则,比如命名风格之类
        let obj = new XXX();
        obj.mId = 1;
        obj.mName = 2222;
        obj.mDescInfo = 3333;

        //数据库字段或许没有这种规则
        是这种 id ,name ,descinfo
        这时候就需要自己实现映射规则,将 mId 映射到 id,
        */
        if( propname == this.getPropIdName() ) propname = '_id';
        return propname;
    }

    /**
     * _id 默认 映射到 id
     * 可以继承修改行为
     * 数据库字段映射到对象里面的属性
     *
     * @param {*} fieldname
     * @returns {string} propname
     * @memberof ZWORM
     */
    fieldMapProp( fieldname )
    {
        if( fieldname == '_id' ) fieldname = this.getPropIdName();
        return fieldname;
    }

    /**
     * 获取id字段名字 对应 _id
     *
     * @returns
     * @memberof ZWORM
     */
    getPropIdName()
    {
        return 'id';
    }

    /**
     * 将自己映射为数据存储的对象
     *
     * @returns
     * @memberof ZWORM
     */
    mapToRow()
    {
        let keys = Object.keys( this );
        let dumpobj = {};
        for( let key of keys )
        {
            // _ 开头的字段都不要
            if( key.indexOf('_') == 0 ) continue;
            let v = this[ key ];;
            if( v == undefined ) continue;
            dumpobj[ this.propMapField(key) ] = v;
        }
        return dumpobj;
    }
    /**
     * 将数据库一行数据,映射为一个自己类型的对象
     *
     * @param {*} row
     * @memberof ZWORM
     */
    mapToObj( row )
    {
        let keys = Object.key( row );
        let obj = new this._cls();
        for( let key of keys )
        {
            obj[ this.fieldMapProp(key) ] = row[ key ];
        }
        return obj;
    }

    select( fields = [] )
    {
        for( let f of fields )
        {
            this._selectfields[f] = 1;
        }
        return this;
    }

    sortBy( field,asc = false )
    {
        let obj = {};
        obj[ field ] = asc?1:-1;
        this._sortby.push( obj );
        return this;
    }
    _convertQuery()
    {
        let keys = Object.key( this );
        let q = {};
        q['$and'] = new Array();
        q['$or'] = new Array();
        for( let one of keys )
        {
            let onev = this[one];
            if( onev == undefined ) continue;
            if( onev == null || !(onev instanceof ZWQuery) )
            {//如果不是查询对象,就按普通值来处理,
                q[ this.propMapField( one ) ] = onev;
            }
            else 
            {
                let tmp_q = one.makeQuery( this.propMapField( one ) );
                q[ tmp_q.name ].push( tmp_q[tmp_q.name] );
            }
        }
        //console.log( 'sql:',JSON.stringify( q) );
        return q;
    }
    _find( pageindex ,pagesize )
    {
        let opt = { limit:pagesize,sort:this._sortby,skip:pageindex*pagesize,projection:this._selectfields };
        return this._dbinst.collection( this._tableName ).find( this._convertQuery() ,opt );
    }

    /**
     * 查询数据 
     * 匹配条件就是属性的值
     * @param {number} [pageindex=0] 页码,0开始
     * @param {number} [pagesize=20] 页大小,默认20
     * @returns
     * @memberof ZWORM
     */
    async find( pageindex = 0,pagesize = 20 )
    {
        let arr = await this._find( pageindex,pagesize );
        let rarr = new Array();
        for( let one of arr )
        {
            rarr.push( this.mapToObj( one ) );
        }
        return Promise.resolve( rarr );
    }
    /**
     * 删除自己,删除条件就是属性的值
     * 如果有设置id字段,仅以id作为条件
     * @param {*} [opt=null]
     * @returns
     * @memberof ZWORM
     */
    async removeThis( opt = null )
    {
        let op = opt?opt:this._saveop;
        let id = this[ this.getPropIdName() ];
        let q = {};
        if( id == undefined || id == null )
        {
            q   = this._convertQuery();
        }
        else 
        {
            q[ this.propMapField( this.getPropIdName() ) ] = this[ this.getPropIdName() ];
        }
        return await this._dbinst.collection( this._tableName ).deleteOne( this._convertQuery(),op );
    }

    /**
     * 删除数据
     * 条件就是属性的值作为匹配
     * @param {*} [opt=null]
     * @returns
     * @memberof ZWORM
     */
    async deleteAll( opt = null )
    {
        let op = opt?opt:this._saveop;
        return await this._dbinst.collection( this._tableName ).deleteMany( this._convertQuery(),op );
    }

    /**
     * 插入数据 成功之后自动添加id字段到对象
     * 
     * @param {*} [opt=null]
     * @returns{boolean} 成功/失败
     * @memberof ZWORM
     */
    async insertThis( opt = null )
    {
        //额外添加最后更新和创建时间.
        let dumpobj = this.mapToRow();
        dumpobj.createat = new Date();
        dumpobj.lastModified = new Date();
        let op = opt ? opt:this._saveop;
        let r = await this._dbinst.collection( this._tableName ).insertOne(dumpobj,op);
        if( !r || !r.insertedId ) return Promise.resolve( false );
        this[  this.getPropIdName() ] = r.insertedId;
        return Promise.resolve( true );
    }

    /**
     * 通过ID更新数据,属性的id就作为查询条件 其他属性就是要更新的数据
     * @param {*} u_doc 如果有指明要更新的数据,其他属性就忽略
     * @param {*} [opt=null]
     * @returns{boolean} 成功/失败
     * @memberof ZWORM
     */
    async updateThisById( u_doc = null, opt = null )
    {
        return await this.updateThisBy( this.getPropIdName() ,u_doc,opt );
    }

    /**
     * 通过指定一个 属性 的值作为查询条件更新数据
     * 其他属性就行更新的数据
     * @param {*} u_doc 如果有指明要更新的数据,其他属性就忽略
     * @param {*} propname
     * @param {*} [opt=null]
     * @returns{boolean} 成功/失败
     * @memberof ZWORM
     */
    async updateThisBy( propname, u_doc = null ,opt = null )
    {
        let v = this[ propname ];
        if( v == undefined ) return Promise.resolve(false);
        let q = {};
        q[ this.propMapField( propname ) ] = v;
        let u = u_doc == null ? this.mapToRow():u_doc;
        u.lastModified = new Date();
        delete u[ propname ];
        u = {'$set':u};
        let op = opt ? opt:this._saveop;
        let r = await this._dbinst.collection( this._tableName ).updateOne(q,u,op);
        if( !r ) return Promise.resolve( false );
        return Promise.resolve( true );
    }

    /**
     * 更新数据 属性作为匹配条件
     * 如果有设置id,仅以id作为匹配条件
     * @param {*} u_doc 要更新的数据
     * @param {*} [opt=null]
     * @returns{int} 返回更新了多少条数据
     * @memberof ZWORM
     */
    async updateAll( u_doc , opt = null )
    {
        let op = opt?opt:this._saveop;
        let id = this[ this.getPropIdName() ];
        let q = {};
        if( id == undefined || id == null )
        {
            q   = this._convertQuery();
        }
        else 
        {
            q[ this.propMapField( this.getPropIdName() ) ] = this[ this.getPropIdName() ];
        }
        let u = {};
        u.lastModified = new Date();
        u = { '$set': u_doc };
        let r = await this._dbinst.collection( this._tableName ).updateMany( q ,u,op );
        if( !r || !r.modifiedCount ) return Promise.resolve(0);
        return Promise.resolve(r.modifiedCount);
    }
    async count( )
    {

    }
    /**
     * 更新插入,如果没有对应的数据就插入新的,如果有就更新
     *
     * @param {*} query 匹配条件,原生语句
     * @param {*} upkeys 如果匹配到数据,要更新的部分;(如果没有就所有属性全新插入)
     * @param {*} [opt=null]
     * @returns{boolean} 成功/失败
     * @memberof ZWORM
     */
    async upInsert( query,upkeys,opt = null )
    {
        let q = query;
        let u = {};
        let i = {};
        let keys = Object.keys( this );

        for( let key of keys )
        {
            if( key.indexOf('_' == 0 ) )  continue;
            if( upkeys.indexOf( key ) != -1 )
            {//这个是需要更新的字段
                u[ this.propMapField(key) ] = this[key];
            }
            else 
            {//其他都是需要全新插入的时候需要的,
                i[ this.propMapField(key) ] = this[key];
            }
        }
        let op = opt?opt:this._saveop;

        this._upsertnew = false;
        let r = await this._dbinst.collection( this._tableName ).updateOne( q ,{
             '$set':u,
             '$setOnInsert':i,
             '$currentDate': { lastModified: true }
        },op);

        if( !r || !r.modifiedCount ) return Promise.resolve( false );
        if( r.upsertedId )
        {
            this._upsertnew = true;
            this[ this.getPropIdName() ] = r.upsertedId._id;
        }
        return Promise.resolve( true );
    }

    /**
     * 判断刚刚upInsert是否新插入了数据
     *
     * @returns{boolean} true/false
     * @memberof ZWORM
     */
    isUpsertNew()
    {
        return this._upsertnew;
    }


}



module.exports = ZWORM;
