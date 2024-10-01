import * as dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();


const app = express();
app.use(express.json());

function asyncHandler(handler) {
  return async function (req, res) {
    try {
      await handler(req, res);
    } catch (e) {
      if (e.name === 'ValidationError' 
        || e instanceof Prisma.PrismaClientValidationError) {
        res.status(400).send({ message: "잘못된 요청입니다" });
      //if (e.name === 'StructError' ||
      //    e instanceof Prisma.PrismaClientValidationError)
      // 위 코드는 유효성 검사 실시하면 다시 생각해봄
      }
    };
  }
}


// 게시글 등록
app.post('/api/groups/:id/posts', asyncHandler(async (req, res) => {
  const groupId = Number(req.params.id);

  const postData = { ...req.body, groupId};

  const newPost = await prisma.post.create({
    data: postData,
  });

  const updatedGroup = await prisma.group.update({
    where: { id: groupId },
    data: { postCount: { increment: 1 } }, 
  });

  const { postPassword: ppwd, groupPassword: gpwd, ...postWithoutPasswords } = newPost;
  res.status(200).send(postWithoutPasswords);
}));



// 게시글 목록 조회
app.get('/api/groups/:id/posts', asyncHandler(async (req, res) => {
  const { page = 1, pageSize = 10, sortBy = 'latest', keyword, isPublic = true} = req.query;

  const currentPage = Number(page);
  const itemsPerPage = Number(pageSize);
  const isPublicFilter = isPublic === 'false' ? false : true;

  let orderBy = {};
  if (sortBy === 'latest') {
    orderBy = { createdAt: 'desc' };
  } else if (sortBy === 'mostCommented') {
    orderBy = { commentCount: 'desc' };
  } else if (sortBy === 'mostLiked') {
    orderBy = { likeCount: 'desc' };
  }


  const posts = await prisma.post.findMany({
    where: {
       groupId: Number(req.params.groupId),  
       isPublic: isPublicFilter, 
       OR: [
         { title: { contains: keyword } }, 
         { tags: { has: keyword } },         
       ],
     },
     orderBy,  
     skip: (currentPage - 1) * itemsPerPage, 
     take: itemsPerPage,  
     select: {
       id: true,
       nickname: true,
       title: true,
       imageUrl: true,
       tags: true,
       location: true,
       moment: true,
       isPublic: true,
       likeCount: true,
       commentCount: true,
       createdAt: true,
     },
  });

  const totalItemCount = await prisma.post.count({
    where: {
       groupId: Number(req.params.groupId),        
       isPublic: isPublicFilter,
      OR: [
         { title: { contains: keyword } },
         { tags: { has: keyword } },
       ],
    },    
  });

  const totalPages = Math.ceil(totalItemCount / itemsPerPage);

   const postResponse = {
    currentPage,
    totalPages,
     totalItemCount,
     data: posts,
  };

  res.status(200).json(postResponse);

  
}));



// 게시글 상세 정보 조회
app.get('/api/posts/:id', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const post = await prisma.post.findUnique({
    where: { id },
    include: {
      comments: true,
    },
  });

  const { postPassword, groupPassword, ...postWithoutPasswords } = post;
  res.status(200).send(postWithoutPasswords);
}));



// 게시글 수정
app.put('/api/posts/:id', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const password = req.body.postPassword;
  const post = await prisma.post.findUnique({
    where: { id },
  });

  if (!post) {
    return res.status(404).send({ message: '존재하지 않습니다' });
  }

  if (post.postPassword === password) {
    const updatedPost = await prisma.post.update({
      where : { id },
      data: req.body,
    });

    const { postPassword, ...postWithoutPassword } = updatedPost;
    res.status(200).send(postWithoutPassword);
  } else {
    res.status(403).send({ message: '비밀번호가 틀렸습니다' });
  } 
}));



// 게시글 삭제
app.delete('/api/posts/:id', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const password = req.body.postPassword;
  const post = await prisma.post.findUnique({
    where: { id },
  });

  if (!post) {
    return res.status(404).send({ message: '존재하지 않습니다' });
  }

  if ( post.postPassword === password) {
    await prisma.post.delete({
      where: { id }, 
    });
    res.status(200).send({ message: '게시글 삭제 성공' });
  } else {
    res.status(403).send({ message: '비밀번호가 틀렸습니다' });
  } 
}));



// 게시글 조회 권한 확인
app.post('/api/posts/:id/verify-password', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const password = req.body.postPassword;
  const post = await prisma.post.findUnique({
    where: { id },
  });
  if (post.postPassword === password) {
    res.status(200).send({ message: '비밀번호가 확인되었습니다' });
  } else {
    res.status(401).send({ message: '비밀번호가 틀렸습니다' });
  }
}));



// 게시글 공감하기
app.post('/api/posts/:id/like', asyncHandlerp(async (req, res) => {
  const id = Number(req.params.id);
  const post = await prisma.post.findUnique({
    where: { id },
  });

  if (post) {
    await prisma.post.update({
      where: { id },
      data: { likeCount: {increment: 1,}}, 
    });
    res.status(200).send({ message: '게시글 공감하기 성공' });
  } else {
    res.status(404).send({ message: '존재하지 않습니다' });
  }
}));



// 게시글 공개 여부
app.get('/api/posts/:id/is-public', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const post = await prisma.post.findUnique({
    where: { id },
  });
  if (post) {
    res.status(200).send({ id: post.id, isPublic: post.isPublic });
  } 
}));








app.listen(3000, () => { console.log('Server Started'); });