import {genSalt, hash} from "bcryptjs";
import { sign } from "jsonwebtoken"
import { writeDataToSheet, accessSheet } from "@/lib/google-apis/sheets";
import { NextResponse } from "next/server";

const spreadsheetId = process.env.CUSTOMER_SPREADSHEET_ID as string
const generateToken=(id:string)=>{
    return sign({id},`${process.env.JWT_SECRET}`,{
        expiresIn:'10d'
    })
};

export async function POST(req: Request) {
    try{
        const { 
            username, full_name, photo, email, phone_number, location_name, location_lat_long, account_balance, password
        } = await req.json()
        if(username&&full_name&&photo&&email&&phone_number&&location_name&&location_lat_long&&account_balance&&password){
            const salt = await genSalt(10);
            const hashedPassword = await hash(password, salt);

            const rows:any = await accessSheet(spreadsheetId, 'Sheet1!A1:J10')
            const emailExists = rows.some((row: any) => row.includes(email)); 
            const phoneExists = rows.some((row: any) => row.includes(phone_number)); 
            const usernameExists = rows.some((row: any) => row.includes(username)); 
            
            if (emailExists) { 
                return NextResponse.json({ error: "A user with this email already exists.", }, { status: 200 }); 
            } else if (phoneExists) { 
                return NextResponse.json({ error: "A user with this phone number already exists.", }, { status: 200 });
            } else if (usernameExists) { 
                return NextResponse.json({ error: "This username is not available, try another.", }, { status: 200 });
            }
    
            const range = `Sheet1!A${rows.length+1}`; 
            // Starting cell for data 
            const values = [[`REF-${rows.length+1}`,
                photo,username,email,hashedPassword,full_name,phone_number,location_name,location_lat_long,account_balance
            ]]; 
            const result = await writeDataToSheet(spreadsheetId, range, values)
            if(result){
                const newRows:any = await accessSheet(spreadsheetId, 'Sheet1!A1:J10')
                let rowIndex = -1; 
                for (let i = 0; i < newRows.length; i++) { 
                    if (newRows[i][3] === email) { 
                        rowIndex = i; 
                        break; 
                    } 
                } 
                if (rowIndex === -1) { 
                    return NextResponse.json({error:`No user found, create account instead`},{status:404})
                }
                
                const data:any={
                    'customer reference':newRows[rowIndex][0],
                    'photo':newRows[rowIndex][1],
                    'username':newRows[rowIndex][2],
                    'email':newRows[rowIndex][3],
                    'full name':newRows[rowIndex][5],
                    'phone number':newRows[rowIndex][6],
                    'location name':newRows[rowIndex][7],
                    'location lat_long':newRows[rowIndex][8],
                    'account balance':newRows[rowIndex][9],
                    'token':generateToken(newRows[rowIndex][0])
                }
                return NextResponse.json({
                    message: `Welcome ${data['username']}`,
                    data
                })
            }else{
                return NextResponse.json({ error: "Sign up failed, try again" }, { status: 500 });
            }
        }else {
            return NextResponse.json({ error: "Enter all the required fields" }, { status: 408 });
        }
    }catch(error:any){
        console.error('Error:', error); // Return an error response
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}