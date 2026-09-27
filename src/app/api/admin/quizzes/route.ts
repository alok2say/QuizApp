import { use } from "react";
import { getCurrentUser } from "../../../../lib/session";
import { validateQuizJson } from "../../../../lib/quiz/quizJsonSchema";
import {createQuizFromJson} from "@/lib/quiz/adminQuizzes"
import { error } from "console";

export async function POST(request: Request) {
    const user = await getCurrentUser()
    if(!user){
        return Response.json({ error: 'Not Authenticated.'}, {status: 401})
    }
    if(user.role !== "ADMIN"){
        return Response.json( {error: 'Forbidden..'}, {status: 403})
    }

    let json: unknown 
    try{
        json = await request.json()
    } catch{
        return Response.json({ error: 'Request body must be valid JSON.'}, {status : 400})
    }

    const validated = validateQuizJson(json)
    if (!validated.ok){
        return Response.json({errors: validated.errors}, {status: 400})
    }

    const quiz = await createQuizFromJson(validated.data)
    return Response.json({id: quiz.id}, {status:201})
}