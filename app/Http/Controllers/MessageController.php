<?php

namespace App\Http\Controllers;
use App\Message;
use Illuminate\Http\Request;

class MessageController extends Controller
{
    public function index() {
        $messages = Message::all();
        return response()->json(compact('messages'));
    }

    public function store(Request $request)
    {
        $message = Message::create(
            $request->all()
        );
        return $message;
    }
}