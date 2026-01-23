<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use App\Services\LicenseService;

class AuthController extends Controller
{
    protected LicenseService $licenseService;

    public function __construct(LicenseService $licenseService)
    {
        $this->licenseService = $licenseService;
    }

    /**
     * Handle user login.
     *
     * @param  \Illuminate\Http\Request  $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function login(Request $request): JsonResponse
    {
        $credentials = $request->validate([
            'email'    => 'required|email',
            'password' => 'required',
        ]);

        if (!Auth::attempt($credentials)) {
            return response()->json(['message' => 'Invalid credentials'], 401);
        }

        /** @var User $user */
        $user = Auth::user();

        // Check license and auto-revoke if machine changed (software copied to new device)
        $licenseCleared = $this->licenseService->clearLicenseIfMachineChanged();

        // Generate API token (Sanctum)
        $token = $user->createToken('api_token')->plainTextToken;

        $response = [
            'token' => $token,
            'user'  => $user->load('roles'),
        ];

        // If license was cleared due to machine change, inform the client
        if ($licenseCleared) {
            $response['license_revoked'] = true;
            $response['message'] = 'License was revoked because software was moved to a new device. Please activate a new license.';
        }

        return response()->json($response);
    }

    /**
     * Get the currently authenticated user.
     *
     * @param  \Illuminate\Http\Request  $request
     * @return \App\Models\User
     */
    public function user(Request $request): User
    {
        /** @var User $user */
        $user = $request->user();

        return $user->load('roles');
    }
    public function updateProfile(Request $request)
{
    $user = $request->user();

    $data = $request->validate([
        'name' => 'required|string|max:255',
        'email' => 'required|email|unique:users,email,' . $user->id,
        'password' => 'nullable|confirmed|min:6',
    ]);

    if (!empty($data['password'])) {
        $data['password'] = bcrypt($data['password']);
    } else {
        unset($data['password']);
    }

    $user->update($data);

    return response()->json($user);
}
// AuthController.php
public function logout(Request $request): \Illuminate\Http\JsonResponse
{
    $request->user()->currentAccessToken()?->delete();
    return response()->json(['message' => 'Logged out']);
}

public function confirmPassword(Request $request)
    {
        $request->validate([
            'password' => 'required|string',
        ]);

        $user = $request->user(); // via sanctum

        if (!$user || !Hash::check($request->password, $user->password)) {
            return response()->json(['message' => 'Invalid password'], 422);
        }

        // You might add throttle/rate-limit here if you wish

        return response()->json(['ok' => true], 200);
    }

}
