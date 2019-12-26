const   ObjectID    = require('mongodb').ObjectID;

/**
 * 查询是针对某个字段进行生成查询语句
 * 如果没有指定,默认有个站位的字段名称
 * 最终生成的时候替换就行了
 * 
 */

class ZWQuery
{

    /**
     * 
     * @param {string} field,字段名称,默认为空,生成的时候替换holder. 
     */
    constructor(field=null)
    {
        this._cond_arr = new Array();

        this._field = field;
        if( field == null )
            this._field = ZWQuery.HolderName();
    }

    /**
     * 获取站位字段名字
     */
    static HolderName()
    {
        return '_zwquery_holder_';
    }

    /**
     * 生成一个查询对象,通过and操作连接其他字段
     * @param {string} op 操作符.见 _appendq 方法
     * @param {*} v 
     * @param {string} field 
     * @param {*} v1 更多参数
     * @returns {ZWQuery} 返回生成的查询对象
     */
    static Query(op,v,field=null,v1=null)
    {
        let q = new ZWQuery(field);
        q._head = 0;
        return q.and(op,v,v1);
    }

     /**
     * 生成一个查询对象,通过 or 操作连接其他字段
     * @param {string} op 
     * @param {*} v 
     * @param {string} field 
     * @param {*} v1 
     * @returns {ZWQuery} 返回生成的查询对象
     */
    static OrQuery(op,v,field = null,v1=null)
    {
        let q = new ZWQuery(field);
        q._head = 1;
        return q.and(op,v,v1);
    }
    _appendq(op,value,value1)
    {
        let q = {};
        let field = this._field;

        if( typeof value == 'string' && ObjectID.isValid(value) )
            value = ObjectID.createFromHexString( value );

        if( typeof value1 == 'string' && ObjectID.isValid(value1) )
            value1 = ObjectID.createFromHexString( value1 );

        switch( op )
        {
            case '==':
            case '$eq':
                q[field] = {'$eq':value};
                break;
            case '>':
            case '$gt':
                q[field] = {'$gt':value};
                break;
            case '=>':
            case '>=':
            case '$gte':
                q[field] = {'$gte':value};
                break;
            case '|':
            case '$in':
                q[field] = {'$in':value};
                break;
            case '<':
            case '$lt':
                q[field] = {'$lt':value};
                break;
            case '=<':
            case '<=':
            case '$lte':
                q[field] = {'$lte':value};
                break;
            case '!=':
            case '$ne':
                q[field] = {'$ne':value};
                break;
            case '!|':
            case '$nin':
                q[field] = {'$ne':value};
                break;
            case '??':
            case '$exists':
                q[field] = {'$ne':value};
                break;
            case '%':
            case '$mod'://余数
                q[field] = {'$mod':[value,value1]};
                break;
            case 'like'://模糊查询,正则表达式匹配
            case '$regex':
                q[field] = {'$regex':value,'options':value1};
                break;
            default:
                throw new Error('query unsupport ops!');
        }
        return q;
    }

    /**
     * and操作其他值
     * @param {*} op 
     * @param {*} v 
     * @param {*} v1 
     * @returns {ZWQuery} 返回this
     */
    and(op,v,v1=null)
    {
        let c = {};
        c.type = 0;
        c.cond = this._appendq(op,v,v1);
        this._cond_arr.push( c );
        return this;
    }

    /**
     * or 操作其他值
     * @param {*} op 
     * @param {*} v 
     * @param {*} v1 
     * @returns {ZWQuery} 返回this
     */
    or(op,v,v1=null)
    {
        let c = {};
        c.type = 1;
        c.cond = this._appendq(op,v,v1);
        this._cond_arr.push( c );
        return this;
    }

    /**
     * 生成最终的查询语句
     * @param {*} realfieldname 
     * @returns {Object} 返回最终的查询语句
     */
    makeQuery( realfieldname )
    {
        const _logics = [ '$and','$or' ];
        let allconds = [ [],[],[] ];
        for( let one  of this._cond_arr )
        {
            //首先做字段替换,
            let fields = Object.keys( one.cond );
            for( let f of fields )
            {
                if( realfieldname == f ) continue;//如果已经换过了,就不管了
                one.cond[ realfieldname ] = one.cond[ f ];
                delete one.cond[ f ];
            }
            allconds[ one.type ].push( one.cond );
        }

        let q = {};
        for( let i = 0 ; i < allconds.length;i++ )
        {
            let one_arr = allconds[ i ];
            if( one_arr.length == 0 ) continue;
            let t = q[ _logics[ this._head] ];
            if( t == undefined )
            {
                t = [];
            }
            if( i != this._head )
            {
                let _sub = {};
                _sub[ _logics[ i ] ] = one_arr;
                one_arr = _sub;
            }
            q[ _logics[this._head] ] = t.concat( one_arr );
        }
        q.name = _logics[this._head];
        return q;
    }
}

module.exports = ZWQuery;
