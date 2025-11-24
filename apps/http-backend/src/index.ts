import { CreateRoomSchema, CreateUserSchema, SignInSchema } from '@repo/common/types';
import { JWT_TOKEN } from '@repo/backend-common/config';
import express from 'express';
import { middleware } from './middleware.js';
import jwt from 'jsonwebtoken';
import { prismaClient } from '@repo/db/client';
import cors from 'cors';

const app = express();
app.use(express.json());

app.use(cors({
  origin: '*'
}));

app.post('/signup', async (req, res) => {
  const fetchedData = CreateUserSchema.safeParse(req.body);
  if (!fetchedData.success) {
    return res.status(400).json({
      message: 'Invalid input',
      errors: fetchedData.error
    })
  }

  try {
    const user = await prismaClient.user.create({
      data: {
        name: fetchedData.data.name,
        email: fetchedData.data.email,
        password: fetchedData.data.password
      } as any
    })
  
    res.json({
      userid: user.id
    })
  } catch (error) {
    console.error('Prisma error:', error);
    res.status(500).json({ 
      message: 'Failed to create user',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
})

app.post('/signin', async (req, res) => {

  const parsedData = SignInSchema.safeParse(req.body);
  if (!parsedData.success) {
    return res.status(400).json({
      message: 'Invalid input'
    })
  }

  //TODO: verify the hashed password here
  const user = await prismaClient.user.findUnique({
    where: {
      email: parsedData.data.email,
      password: parsedData.data.password
    }
  })

  console.log(user)

  if (!user) {
    res.status(403).json({
      message: 'Not authorized'
    });
    return;
  }

  const token = jwt.sign({
    userId: user?.id
  }, JWT_TOKEN)

  res.json({
    token
  })
})

app.post('/room', middleware, async (req, res) => {
  // db call

  const parsedData = CreateRoomSchema.safeParse(req.body);
  if (!parsedData.success) {
    return res.status(400).json({
      message: 'Invalid input'
    })
  }

  //@ts-ignore
  const userId = req.userId;

 try {
   const room = await prismaClient.room.create({
     data: {
       slug: parsedData.data.slug,
       adminId: userId
     }
   })
 
   res.json({
     roomId: room.id
   })
 } catch (error) {
  res.status(500).json({
    message: 'Room with the id exists',
    error
  })
 }
})

app.get('/chats/:roomId', async(req, res) => {
 try {
   const roomId = Number(req.params.roomId);
   const message = await prismaClient.chat.findMany({
     where: { roomId: roomId },
     orderBy: { id: 'desc' },
   })
 
   res.json({ message });
 } catch (error) {
  res.status(500).json({ error })
 }
})

app.get('/room/:slug', async(req, res) => {
  try {
    const slug = req.params.slug;
    const room = await prismaClient.room.findFirst({
      where: {
        slug
      }
    })
  
    res.json({ room })
  } catch (error) {
    res.status(500).json({ error })
  }
})

app.listen(5000, () => {
  console.log('App is running')
})