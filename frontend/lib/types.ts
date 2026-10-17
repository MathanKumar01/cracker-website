export type Product = {code:string;name:string;category:string;unit:string;price:number};
export type CartLine = Product & {quantity:number};
