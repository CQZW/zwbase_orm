
class BBB 
{
    constructor()
    {
    }
}
class AAA extends BBB
{
    constructor()
    {
        super();
    }
    getobj()
    {
        return new this._cls();
    }
}

let obj = new AAA();


//delete xxx['xx'];
let x = obj['dd'];
console.log(  x );