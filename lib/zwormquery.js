
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
        this._and_arr = new Array();
        this._or_arr = new Array();

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
        let q = new ZWORMQuery(field);
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
        let q = new ZWORMQuery(field);
        q._head = 1;
        return q.and(op,v,v1);
    }
    _appendq(op,value,value1)
    {
        let q = {};
        let field = this._field;
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
            case '?':
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
                return null;
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
        this._and_arr.push( this._appendq(op,v,v1) );
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
        this._or_arr.push( this._appendq(op,v,v1) );
        return this;
    }

    /**
     * 生成最终的查询语句
     * @param {*} realfieldname 
     * @returns {Object} 返回最终的查询语句
     */
    makeQuery( realfieldname )
    {
        let q = {};
        if( this._field == ZWQuery.HolderName() )
        {
            for( let one of this._and_arr )
            {
                one[ realfieldname ] = one[ this._field ];
                delete one[ this._field ];
            }
            for( let one of this._or_arr )
            {
                one[ realfieldname ] = one[ this._field ];
                delete one[ this._field ];
            }
        }
        q['$and'] = this._and_arr;
        if( this._or_arr.length )
        {
            let orq = {};
            orq['$or'] = this._or_arr;
            q['$and'].push( orq );
        }
        //如果对应这个字段的查询本来就或关系
        if( this._head == 1 )
        { 
            q = { '$or':[ q ] };
            q.name = '$or';
        }
        return q;
    }

}

module.exports = ZWQuery;
