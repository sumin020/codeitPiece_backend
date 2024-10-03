import * as dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const app = express();
app.use(express.json());
const commentRouter = express.Router();

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

commentRouter.route('/posts/:id/comments')
  //댓글 목록 조회
  .get( asyncHandler (async (req, res) => {
    const {page = 1, pageSize = 10, commentId} = req.query;
    const postId = Number(req.params.id);  
    const currentPage = parseInt(page);
    const itemsPerPage = parseInt(pageSize);

    const comments = await prisma.comment.findMany({
      where: { postId: postId },
      skip: (currentPage - 1) * itemsPerPage,
      take: itemsPerPage,
      select: {
       id: true,
		  	nickname: true,
		  	content: true,
		  	createdAt: true,
      }
   });
  
   const totalItemCount = await prisma.comment.count({where: { postId: postId }});
   const totalPages = Math.ceil(totalItemCount / pageSize);
   const commentResponse = {
     currentPage,
     totalPages,
     totalItemCount,
     data: comments,
    };
   res.status(200).send(commentResponse);
  }))

    // 댓글 등록
  .post(asyncHandler(async (req, res) => {
    const postId = Number(req.params.id);
   const commentData = { ...req.body, postId };

    const newComment = await prisma.comment.create({
     data: commentData,
   });

   await prisma.post.update({
     where: { id: postId },
     data: { commentCount: { increment: 1 } },
   });

   const { password: pwd, ...commentWithoutPassword } = newComment;
   res.status(200).send(commentWithoutPassword);
  }));


commentRouter.route('/comments/:id')
// 댓글 수정
  .put(asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const password = req.body.password;
    const comment = await prisma.comment.findUnique({
      where: { id },
    });

    if (!comment) {
      return res.status(404).send({ message: '존재하지 않습니다' });
   }

    if (comment.password === password) {
      const updatedComment = await prisma.comment.update({
        where : { id },
        data: req.body,
      });

      const { password, ...commentWithoutPassword } = updatedComment;
      res.status(200).send(commentWithoutPassword);
    } else {
     res.status(403).send({ message: '비밀번호가 틀렸습니다' });
    } 
  }))

  // 댓글 삭제
  .delete( asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const password = req.body.password;
    const comment = await prisma.comment.findUnique({
     where: { id },
   });

    if (!comment) {
      return res.status(404).send({ message: '존재하지 않습니다' });
    }

   if (comment.password === password) {
      await prisma.comment.delete({
        where: { id }, 
      });
    
      await prisma.post.update({
        where: { id: comment.postId },
        data: { commentCount: { decrement: 1 } },
      });

      res.status(200).send({ message: '답글 삭제 성공' });
    } else {
      res.status(403).send({ message: '비밀번호가 틀렸습니다' });
    } 
  }));

app.use('/api', commentRouter);
export default commentRouter;
